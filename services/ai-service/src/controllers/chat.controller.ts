import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/index.js';
import { createSuccessResponse, createErrorResponse } from '@lms/types';
import { logger } from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import { handlePrismaError } from '../lib/prisma-errors.js';
import { checkRateLimit } from '../lib/gemini.js';
import { guardInput, redactPII } from '../lib/input-guard.js';
import { verifyEnrollment } from '../lib/access-control.js';
import { fetchAiContextStatus, fetchCourseContext, fetchLessonAiContext, fetchCompletionStatus } from '../lib/course-client.js';
import { streamGenerateText } from '../lib/gemini.js';
import {
  buildContextPack,
  buildLexicalSearchSnippets,
  formatContextQualityForPrompt,
  type ContextPack,
} from '../lib/ai-quality.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_CHAT_PER_HOUR = 30;
const CHAT_RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const MAX_RECENT_MESSAGES = 6;
const MAX_SUMMARY_MESSAGES = 10;
const MIN_CONTEXT_LENGTH = 1;
const MAX_CHAT_CONTEXT_CHARS = 1400;
const MAX_CHAT_DESCRIPTION_CHARS = 180;
const MAX_CHAT_LESSON_CONTENT_CHARS = 220;

// ─── Public: AI Context Status ───────────────────────────────────────────────

/** GET /api/chat/ai-context/:lessonId */
export async function getAiContextStatus(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || randomUUID();
  const { lessonId } = req.params;
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json(createErrorResponse('Unauthorized', 401, traceId));
  }

  try {
    const status = await fetchAiContextStatus(lessonId, traceId);
    return res.status(200).json(createSuccessResponse(status, undefined, traceId));
  } catch (err) {
    logger.warn({ err, lessonId, traceId }, 'getAiContextStatus error');
    return res.status(200).json(createSuccessResponse({
      available: true,
      sources: ['BEST_EFFORT'],
      transcriptStatus: 'READY',
      contentLength: 0,
      sourceType: 'AUTO_CONTEXT',
      contentKind: 'KEYWORD_CONTEXT',
      quality: 'LOW',
      fallbackUsed: true,
      processing: false,
      failedAutoStt: false,
      reason: 'CONTEXT_STATUS_UNAVAILABLE',
    }, undefined, traceId));
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTranscriptWindow(
  segments: { start: number; end: number; text: string }[],
  currentTimeSec: number,
  windowSec = 120,
): string {
  const start = Math.max(0, currentTimeSec - windowSec);
  const end = currentTimeSec + windowSec;
  return segments
    .filter((s) => s.start >= start && s.end <= end)
    .map((s) => s.text)
    .join(' ');
}

function sanitizeContextText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFC')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[┌┐└┘├┤┬┴┼═║╔╗╚╝]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateContextText(value: string | null | undefined, maxChars: number): string {
  const clean = sanitizeContextText(value);
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function extractContextKeywords(value: string, maxKeywords = 8): string[] {
  const ignored = new Set([
    'khoa', 'hoc', 'bai', 'chuong', 'noi', 'dung', 'giang', 'vien', 'thuc', 'hanh',
    'course', 'lesson', 'chapter', 'the', 'and', 'with', 'for', 'can', 'ban', 'mot',
  ]);
  const matches = sanitizeContextText(value)
    .toLowerCase()
    .match(/[a-z0-9.+#-]{3,}|[a-z]+\.js|next\.js/gi) || [];

  const keywords: string[] = [];
  for (const item of matches) {
    const keyword = item.trim().toLowerCase();
    if (ignored.has(keyword) || keywords.includes(keyword)) continue;
    keywords.push(keyword);
    if (keywords.length >= maxKeywords) break;
  }
  return keywords;
}

type ChatIntent = 'course_explanation' | 'practice_help' | 'progress_check' | 'out_of_scope';

interface ChatLearningState {
  progress?: {
    completedLessons: number;
    totalLessons: number;
    progressPercent: number;
    isCompleted: boolean;
  } | null;
  quizHistory?: {
    bestScore: number | null;
    attemptCount: number;
    latestScore: number | null;
  };
}

function classifyChatIntent(content: string): ChatIntent {
  const lower = sanitizeContextText(content).toLowerCase();
  if (/(diem|score|tien do|hoan thanh|chung chi|certificate|quiz)/i.test(lower)) return 'progress_check';
  if (/(bai tap|vi du|thuc hanh|lam sao|code|debug|giai thich)/i.test(lower)) return 'practice_help';
  if (/(thoi tiet|gia co phieu|chinh tri|tin tuc|mua ban|doi tu)/i.test(lower)) return 'out_of_scope';
  return 'course_explanation';
}

async function getQuizLearningState(
  userId: string,
  courseId: string,
): Promise<ChatLearningState['quizHistory']> {
  const sessions = await prisma.aiQuizSession.findMany({
    where: { userId, courseId, status: 'SUBMITTED' },
    orderBy: { submittedAt: 'desc' },
    take: 10,
    select: { score: true },
  });

  const scores = sessions
    .map((item) => item.score)
    .filter((score): score is number => typeof score === 'number');

  return {
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
    latestScore: scores[0] ?? null,
    attemptCount: sessions.length,
  };
}

function compactChatContext(parts: string[]): string {
  const selected: string[] = [];
  let total = 0;
  for (const part of parts.map((item) => item.trim()).filter(Boolean)) {
    const line = truncateContextText(part, 260);
    if (total + line.length + 1 > MAX_CHAT_CONTEXT_CHARS) break;
    selected.push(line);
    total += line.length + 1;
  }
  return selected.join('\n');
}

function buildSystemPrompt(
  courseTitle: string,
  level: string,
  lessonTitle?: string,
  textContent?: string,
  recentMessages?: { role: string; content: string }[],
  summaryText?: string,
  contextPack?: ContextPack,
  lexicalSnippets: string[] = [],
  learningState?: ChatLearningState,
  intent: ChatIntent = 'course_explanation',
): string {
  let prompt = `Ban la tro ly hoc tap AI cua he thong OLMS.

VAI TRO:
- Ho tro hoc vien hieu bai hoc sau hon.
- Dung chu de, tu khoa va text giang vien cung cap lam neo ngu canh.
- Duoc phep mo rong kien thuc nen tang lien quan truc tiep den khoa hoc/bai hoc.
- Neu cau tra loi la kien thuc mo rong ngoai text giang vien cung cap, hay noi ro do la "phan mo rong tham khao".

KHOA HOC: "${courseTitle}"
TRINH DO: ${level}
Y DINH CAU HOI: ${intent}
`;

  if (lessonTitle && textContent) {
    prompt += `
BAI HOC HIEN TAI: "${lessonTitle}"
NGU CANH/TU KHOA:
${textContent}
`;
  }

  if (contextPack) {
    prompt += `
CHAT_CONTEXT_PACK:
${formatContextQualityForPrompt(contextPack)}
`;
  }

  if (lexicalSnippets.length > 0) {
    prompt += `
KET QUA TIM KIEM NOI BO GAN NHAT:
${lexicalSnippets.map((item, index) => `${index + 1}. ${item}`).join('\n')}
`;
  }

  if (learningState?.progress) {
    prompt += `
TIEN DO HOC VIEN:
- Hoan thanh: ${learningState.progress.completedLessons}/${learningState.progress.totalLessons} bai (${learningState.progress.progressPercent}%).
- Trang thai khoa hoc: ${learningState.progress.isCompleted ? 'da hoan thanh' : 'dang hoc'}.
`;
  }

  if (learningState?.quizHistory) {
    prompt += `
LICH SU QUIZ GAN DAY:
- So lan nop: ${learningState.quizHistory.attemptCount}.
- Diem gan nhat: ${learningState.quizHistory.latestScore ?? 'chua co'}.
- Diem cao nhat: ${learningState.quizHistory.bestScore ?? 'chua co'}.
`;
  }

  if (summaryText) {
    prompt += `\nTOM TAT CUOC HOI THOAI TRUOC DO:\n${summaryText}\n`;
  }

  if (recentMessages && recentMessages.length > 0) {
    const history = recentMessages
      .slice(-MAX_RECENT_MESSAGES)
      .map((m) => {
        // Cat ngan de tiet kiem token.
        const text = m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content;
        return `${m.role === 'user' ? 'Hoc vien' : 'AI'}: ${text}`;
      })
      .join('\n');
    prompt += `\nTIN NHAN GAN DAY:\n${history}\n`;
  }

  prompt += `
QUY TAC:
1. Uu tien noi dung/tu khoa trong ngu canh; khong dua cau tra loi di xa chu de khoa hoc.
2. Duoc mo rong kien thuc nen tang de giai thich, tao vi du, so sanh va goi y cach hoc.
3. Khong khang dinh chi tiet la noi dung trong video neu ngu canh khong neu ro.
4. Neu hoc vien hoi ve chi tiet can tinh chinh xac cua bai giang, hay khuyen xem lai bai hoc hoac hoi giang vien.
5. Dung markdown: **bold**, \`code\`, danh sach, code block khi can.
6. Tra loi bang tieng Viet.
7. Neu intent ngoai pham vi hoc tap, tu choi ngan gon va keo cau hoi ve khoa hoc.

GIOI HAN:
- Khong tra loi ngoai pham vi hoc tap.
- Khong tiet lo thong tin ca nhan.
`;

  return prompt;
}

function applyResponseSelfCheck(response: string, contextPack: ContextPack, intent: ChatIntent): string {
  const clean = response.trim();
  if (!clean) return clean;
  if (intent === 'out_of_scope') {
    return clean;
  }
  if (contextPack.coverage.quality === 'LOW' && !/tham kh/i.test(clean)) {
    return `Lưu ý: phần dưới đây có dùng kiến thức mở rộng tham khảo vì ngữ cảnh khóa học còn mỏng.\n\n${clean}`;
  }
  return clean;
}

async function buildChatContext(
  courseContext: NonNullable<Awaited<ReturnType<typeof fetchCourseContext>>>,
  lessonId: string | undefined,
  currentTimeSec: number | undefined,
  _traceId: string,
): Promise<{ textContent: string; sources: string[] }> {
  const sources: string[] = [];
  const allLessons = courseContext.curriculum.flatMap((ch) =>
    ch.lessons.map((lesson) => ({ ...lesson, chapterTitle: ch.title })),
  );
  const currentLesson = lessonId ? allLessons.find((lesson) => lesson.id === lessonId) : undefined;
  const chapterTitles = courseContext.curriculum.map((chapter, index) => `${index + 1}. ${chapter.title}`);
  const nearbyLessons = currentLesson
    ? allLessons.filter((lesson) => lesson.chapterTitle === currentLesson.chapterTitle).slice(0, 6)
    : allLessons.slice(0, 8);
  const keywords = extractContextKeywords([
    courseContext.title,
    courseContext.description || '',
    currentLesson?.chapterTitle || '',
    currentLesson?.title || '',
    currentLesson?.content || '',
    ...chapterTitles,
  ].join(' '), 10);

  const contextParts = [
    `Khoa hoc: ${courseContext.title}`,
    courseContext.description ? `Mo ta ngan: ${truncateContextText(courseContext.description, MAX_CHAT_DESCRIPTION_CHARS)}` : '',
    courseContext.level ? `Trinh do: ${courseContext.level}` : '',
    chapterTitles.length > 0 ? `Cac chuong: ${chapterTitles.join(' | ')}` : '',
    currentLesson ? `Chuong hien tai: ${currentLesson.chapterTitle}` : '',
    currentLesson ? `Bai hoc hien tai: ${currentLesson.title}` : '',
    currentLesson?.content ? `Goi y noi dung: ${truncateContextText(currentLesson.content, MAX_CHAT_LESSON_CONTENT_CHARS)}` : '',
    nearbyLessons.length > 0 ? `Bai lien quan: ${nearbyLessons.map((lesson) => lesson.title).join(' | ')}` : '',
    keywords.length > 0 ? `Tu khoa: ${keywords.join(', ')}` : '',
    'Che do AI: giai thich co ban, mo rong kien thuc lien quan; khong xem day la transcript day du cua khoa hoc.',
  ];

  if (currentTimeSec !== undefined && lessonId) {
    contextParts.push(`Vi tri video tham khao: ${currentTimeSec} giay.`);
  }
  sources.push('COURSE_METADATA', 'LESSON_METADATA', 'KEYWORD_CONTEXT');

  return { textContent: `[COMPACT_CONTEXT]\n${compactChatContext(contextParts)}`, sources: Array.from(new Set(sources)) };
}

async function getRecentMessages(conversationId: string): Promise<{ role: string; content: string }[]> {
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: MAX_RECENT_MESSAGES,
    select: { role: true, content: true },
  });
  return messages.reverse();
}

async function getOrCreateSummary(conversationId: string): Promise<string | undefined> {
  const summary = await prisma.aiConversationSummary.findUnique({
    where: { conversationId },
  });
  return summary?.summaryText ?? undefined;
}

async function maybeUpdateSummary(conversationId: string): Promise<void> {
  const messageCount = await prisma.aiMessage.count({ where: { conversationId } });
  const existingSummary = await prisma.aiConversationSummary.findUnique({
    where: { conversationId },
  });

  // Auto-summary every 10 messages, or on first summary
  if (messageCount % MAX_SUMMARY_MESSAGES === 0 || (!existingSummary && messageCount >= 5)) {
    const messages = await prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: messageCount,
      select: { role: true, content: true },
    });

    const summaryInput = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const summaryPrompt = `Tóm tắt cuộc hội thoại sau bằng tiếng Việt, trong 2-3 câu, chỉ ghi ý chính:\n${summaryInput}`;

    try {
      const { generateText } = await import('../lib/gemini.js');
      const summary = await generateText(summaryPrompt, undefined, { maxTokens: 200 });

      await prisma.aiConversationSummary.upsert({
        where: { conversationId },
        create: { conversationId, summaryText: summary, messageIndex: messageCount },
        update: { summaryText: summary, messageIndex: messageCount },
      });
    } catch (err) {
      logger.warn({ err, conversationId }, 'Auto summary failed');
    }
  }
}

// ─── Validation Schemas ─────────────────────────────────────────────────────────

const createConversationSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  lessonId: z.string().uuid().optional(),
  currentTimeSec: z.number().int().min(0).optional(),
});

// ─── Controllers ────────────────────────────────────────────────────────────────

/** POST /ai/api/chat/conversations — Tao cuộc trò chuyện mới */
export async function createConversation(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const parsed = createConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(createErrorResponse(parsed.error.errors[0].message, 400, traceId));
    }

    const { courseId, lessonId, title } = parsed.data;

    // Verify enrollment
    const enrolled = await verifyEnrollment(userId, courseId, traceId);
    if (!enrolled) {
      return res.status(403).json(createErrorResponse('Bạn chưa ghi danh khóa học này', 403, traceId));
    }

    const conversation = await prisma.aiConversation.create({
      data: {
        userId,
        courseId,
        lessonId,
        title: title || 'Cuộc trò chuyện mới',
      },
    });

    logger.info({ userId, courseId, conversationId: conversation.id, traceId }, 'Conversation created');
    return res.status(201).json(createSuccessResponse(conversation, 'Conversation created', traceId, 201));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'createConversation');
  }
}

/** GET /ai/api/chat/conversations — List cuộc trò chuyện của user */
export async function listConversations(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : undefined;
    const where = { userId, ...(courseId ? { courseId } : {}) };

    const [conversations, total] = await Promise.all([
      prisma.aiConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { messages: true } },
        },
      }),
      prisma.aiConversation.count({ where }),
    ]);

    return res.status(200).json(createSuccessResponse({
      conversations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, 'OK', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listConversations');
  }
}

/** GET /ai/api/chat/conversations/:id — Lay chi tiết cuộc trò chuyện */
export async function getConversation(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const { id } = req.params;

    const conversation = await prisma.aiConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, isError: true, sources: true, metadata: true, createdAt: true },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json(createErrorResponse('Conversation not found', 404, traceId));
    }

    if (conversation.userId !== userId) {
      return res.status(403).json(createErrorResponse('Forbidden', 403, traceId));
    }

    return res.status(200).json(createSuccessResponse(conversation, 'OK', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getConversation');
  }
}

/** DELETE /ai/api/chat/conversations/:id — Xoa cuộc trò chuyện */
export async function deleteConversation(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const { id } = req.params;

    const conversation = await prisma.aiConversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json(createErrorResponse('Conversation not found', 404, traceId));
    }
    if (conversation.userId !== userId) {
      return res.status(403).json(createErrorResponse('Forbidden', 403, traceId));
    }

    await prisma.aiConversation.delete({ where: { id } });

    return res.status(200).json(createSuccessResponse(null, 'Conversation deleted', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteConversation');
  }
}

/** GET /ai/api/chat/conversations/:id/messages — Lay tin nhắn cuộc trò chuyện (cursor pagination) */
export async function getMessages(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const { id } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const conversation = await prisma.aiConversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json(createErrorResponse('Conversation not found', 404, traceId));
    }
    if (conversation.userId !== userId) {
      return res.status(403).json(createErrorResponse('Forbidden', 403, traceId));
    }

    const messages = await prisma.aiMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const results = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

    return res.status(200).json(createSuccessResponse({
      messages: results.reverse(),
      nextCursor,
      hasMore,
    }, 'OK', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getMessages');
  }
}

/** POST /ai/api/chat/conversations/:id/messages — Gui tin nhan + SSE stream */
export async function sendMessage(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const { id } = req.params;

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(createErrorResponse(parsed.error.errors[0].message, 400, traceId));
    }

    const { content: rawContent, lessonId, currentTimeSec } = parsed.data;

    // Verify conversation ownership
    const conversation = await prisma.aiConversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json(createErrorResponse('Conversation not found', 404, traceId));
    }
    if (conversation.userId !== userId) {
      return res.status(403).json(createErrorResponse('Forbidden', 403, traceId));
    }

    // Input guard
    const guardResult = guardInput(rawContent, traceId);
    if (!guardResult.allowed) {
      return res.status(400).json(createErrorResponse(guardResult.reason || 'Invalid message', 400, traceId));
    }

    const content = guardResult.sanitized;
    const intent = classifyChatIntent(content);

    // Rate limit (30 msg / hour)
    const rateKey = `ratelimit:ai:chat:${userId}`;
    const rate = await checkRateLimit(rateKey, MAX_CHAT_PER_HOUR, CHAT_RATE_LIMIT_WINDOW);
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(rate.resetAt / 1000)));

    if (!rate.allowed) {
      return res.status(429).json(createErrorResponse(
        'Đã đạt giới hạn 30 tin nhắn mỗi giờ. Vui lòng thử lại sau.',
        429,
        traceId,
      ));
    }

    // Update conversation lessonId if provided
    if (lessonId) {
      await prisma.aiConversation.update({
        where: { id },
        data: { lessonId },
      });
    }

    // AI Context Check
    const effectiveLessonId = lessonId || conversation.lessonId;
    let lessonContext: Awaited<ReturnType<typeof fetchLessonAiContext>> | null = null;
    if (effectiveLessonId) {
      lessonContext = await fetchLessonAiContext(effectiveLessonId, traceId);
      if (!lessonContext) {
        logger.warn({ lessonId: effectiveLessonId, traceId }, 'Lesson AI context unavailable, using course fallback');
      } else if (lessonContext.courseId !== conversation.courseId) {
        return res.status(403).json(createErrorResponse('Lesson does not belong to this course', 403, traceId));
      }

      if (process.env.AI_STRICT_CONTEXT_GATE === 'true' && lessonContext && !lessonContext.available) {
        const errorMessages: Record<string, string> = {
          TRANSCRIPT_PROCESSING: 'AI đang xử lý nội dung video. Vui lòng quay lại sau.',
          TRANSCRIPT_FAILED: 'Không thể tạo transcript tự động. Vui lòng liên hệ giảng viên.',
          NEEDS_MANUAL_TRANSCRIPT: 'Bài học chưa có nội dung chi tiết. AI sẽ dùng ngữ cảnh khóa học khi tắt strict gate.',
          VIDEO_TOO_LARGE: 'Video vượt giới hạn xử lý. Giảng viên cần chia nhỏ video.',
          NO_CONTEXT: 'Bài học chưa có ngữ cảnh AI.',
          COURSE_SERVICE_UNAVAILABLE: 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại sau.',
        };

        const message = errorMessages[lessonContext.reason || ''] || 'AI chưa có đủ ngữ cảnh cho bài học này.';
        return res.status(422).json(createErrorResponse(message, 422, traceId));
      }
    }

    // Save user message
    const userMessage = await prisma.aiMessage.create({
      data: {
        conversationId: id,
        role: 'user',
        content,
        metadata: {
          intent,
          lessonId: effectiveLessonId ?? null,
          currentTimeSec: currentTimeSec ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    // Update conversation timestamp
    await prisma.aiConversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Build context
    const courseContext = await fetchCourseContext(conversation.courseId, traceId);
    if (!courseContext) {
      return res.status(500).json(createErrorResponse('Không thể lấy thông tin khóa học', 500, traceId));
    }

    const lessonContextMap = effectiveLessonId && lessonContext
      ? { [effectiveLessonId]: lessonContext }
      : {};
    const contextPack = buildContextPack(courseContext, lessonContextMap, effectiveLessonId ?? undefined);
    const lexicalSnippets = buildLexicalSearchSnippets(courseContext, content);
    const learningState: ChatLearningState = {
      progress: await fetchCompletionStatus(userId, conversation.courseId, traceId),
      quizHistory: await getQuizLearningState(userId, conversation.courseId),
    };

    const { textContent: contextText, sources } = await buildChatContext(
      courseContext,
      effectiveLessonId ?? undefined,
      currentTimeSec,
      traceId,
    );
    const mergedSources = Array.from(new Set([
      ...sources,
      ...contextPack.coverage.sources,
      ...(lexicalSnippets.length > 0 ? ['LEXICAL_COURSE_SEARCH'] : []),
      ...(learningState.progress ? ['LEARNING_PROGRESS'] : []),
      ...(learningState.quizHistory?.attemptCount ? ['QUIZ_HISTORY'] : []),
    ]));

    if (!contextText || contextText.trim().length < MIN_CONTEXT_LENGTH) {
      // Save error message
      await prisma.aiMessage.create({
        data: {
          conversationId: id,
          role: 'assistant',
          content: 'AI chưa tạo được ngữ cảnh cho bài học này. Vui lòng thử lại sau hoặc bổ sung mô tả bài học.',
          sources: mergedSources as unknown as Prisma.InputJsonValue,
          metadata: {
            contextQuality: contextPack.coverage.quality,
            coverage: contextPack.coverage,
            intent,
          } as unknown as Prisma.InputJsonValue,
          isError: true,
        },
      });
      return res.status(422).json(createErrorResponse(
        'AI chưa tạo được ngữ cảnh cho bài học này. Vui lòng thử lại sau hoặc bổ sung mô tả bài học.',
        422,
        traceId,
      ));
    }

    // Get recent messages + summary for context
    const recentMessages = await getRecentMessages(id);
    const summaryText = await getOrCreateSummary(id);

    const systemPrompt = buildSystemPrompt(
      courseContext.title,
      courseContext.level,
      effectiveLessonId
        ? courseContext.curriculum.flatMap((ch) => ch.lessons).find((l) => l.id === effectiveLessonId)?.title
        : undefined,
      contextText,
      recentMessages,
      summaryText,
      contextPack,
      lexicalSnippets,
      learningState,
      intent,
    );

    // SSE setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Helper to send SSE event
    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Send user message ID to client
    sendEvent('message_id', { messageId: userMessage.id });
    sendEvent('agent_step', {
      step: 'context_pack',
      label: 'Đã tải ngữ cảnh khóa học',
      quality: contextPack.coverage.quality,
      coverage: contextPack.coverage.coveragePercent,
    });
    if (lexicalSnippets.length > 0) {
      sendEvent('agent_step', {
        step: 'course_search',
        label: 'Đã tìm nội dung liên quan trong khóa học',
        matches: lexicalSnippets.length,
      });
    }
    sendEvent('agent_step', {
      step: 'learning_state',
      label: 'Đã kiểm tra tiến độ và lịch sử quiz',
      hasProgress: Boolean(learningState.progress),
      quizAttempts: learningState.quizHistory?.attemptCount ?? 0,
    });

    // Stream from Gemini
    let fullResponse = '';
    let errorOccurred = false;
    if (contextPack.coverage.quality === 'LOW' && intent !== 'out_of_scope') {
      const note = 'Lưu ý: phần trả lời có thể dùng kiến thức mở rộng tham khảo vì ngữ cảnh khóa học còn mỏng.\n\n';
      fullResponse += note;
      sendEvent('chunk', { text: note });
    }

    try {
      for await (const chunk of streamGenerateText(content, systemPrompt)) {
        if (chunk.error) {
          errorOccurred = true;
          if (chunk.code === 'RATE_LIMITED') {
            const retrySeconds = chunk.retryAfterMs ? Math.ceil(chunk.retryAfterMs / 1000) : undefined;
            fullResponse = retrySeconds
              ? `AI dang tam het quota. Vui long thu lai sau ${retrySeconds} giay.`
              : 'AI dang tam het quota. Vui long thu lai sau.';
          } else {
            fullResponse = 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.';
          }
          sendEvent('error', { message: fullResponse, code: chunk.code, retryAfterMs: chunk.retryAfterMs });
          break;
        }

        if (chunk.done) {
          sendEvent('done', {
            sources: mergedSources,
            contextQuality: contextPack.coverage.quality,
            coverage: contextPack.coverage,
          });
          break;
        }

        fullResponse += chunk.text;
        sendEvent('chunk', { text: chunk.text });
      }
    } catch (streamErr) {
      logger.warn({ err: streamErr, traceId }, 'Gemini stream error');
      errorOccurred = true;
      fullResponse = 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.';
      sendEvent('error', { message: fullResponse });
    }

    // Redact PII and save assistant message
    const safeResponse = redactPII(applyResponseSelfCheck(fullResponse, contextPack, intent));
    await prisma.aiMessage.create({
      data: {
        conversationId: id,
        role: 'assistant',
        content: safeResponse,
        tokenCount: Math.ceil(fullResponse.length / 4),
        sources: mergedSources as unknown as Prisma.InputJsonValue,
        metadata: {
          contextQuality: contextPack.coverage.quality,
          coverage: contextPack.coverage,
          intent,
          lexicalMatches: lexicalSnippets.length,
          progressPercent: learningState.progress?.progressPercent ?? null,
          quizAttempts: learningState.quizHistory?.attemptCount ?? 0,
          errorOccurred,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Heartbeat + cleanup
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    res.on('close', async () => {
      clearInterval(heartbeat);
      await maybeUpdateSummary(id);
      logger.info({ conversationId: id, userId, traceId }, 'SSE connection closed');
    });

    res.end();
    return;
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'sendMessage');
  }
}
