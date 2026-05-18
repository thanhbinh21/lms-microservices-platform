import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '@lms/types';
import { logger } from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import { handlePrismaError } from '../lib/prisma-errors.js';
import { checkRateLimit } from '../lib/gemini.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { guardInput, redactPII } from '../lib/input-guard.js';
import { verifyEnrollment } from '../lib/access-control.js';
import { fetchAiContextStatus, fetchTranscript, fetchCourseContext, fetchLessonContext } from '../lib/course-client.js';
import { streamGenerateText } from '../lib/gemini.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_CHAT_PER_HOUR = 30;
const CHAT_RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const MAX_RECENT_MESSAGES = 20;
const MAX_SUMMARY_MESSAGES = 10;
const MIN_CONTEXT_LENGTH = 500;
const MIN_QUIZ_CONTEXT_LENGTH = 1000;
const MIN_FINAL_QUIZ_COVERAGE = 0.5;
const QUIZ_PASS_SCORE = 70;
const QUIZ_SESSION_EXPIRY_MINUTES = 30;

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
    return res.status(503).json(createErrorResponse('AI service temporarily unavailable', 503, traceId));
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

function buildSystemPrompt(
  courseTitle: string,
  level: string,
  lessonTitle?: string,
  textContent?: string,
  recentMessages?: { role: string; content: string }[],
  summaryText?: string,
): string {
  let prompt = `Bạn là trợ lý học tập AI của hệ thống OLMS.

VAI TRÒ:
- Hỗ trợ học viên hiểu bài học sâu hơn
- Trả lời dựa trên nội dung text bên dưới (lesson content, transcript, subtitle)
- Gợi ý bài học tiếp theo khi phù hợp

KHÓA HỌC: "${courseTitle}"
TRÌNH ĐỘ: ${level}
`;

  if (lessonTitle && textContent) {
    prompt += `
BÀI HỌC HIỆN TẠI: "${lessonTitle}"
NỘI DUNG:
${textContent}
`;
  }

  if (summaryText) {
    prompt += `\nTÓM TẮT CUỘC HỘI THOẠI TRƯỚC ĐÓ:\n${summaryText}\n`;
  }

  if (recentMessages && recentMessages.length > 0) {
    const history = recentMessages.slice(-MAX_RECENT_MESSAGES).map((m) => `${m.role === 'user' ? 'Học viên' : 'AI'}: ${m.content}`).join('\n');
    prompt += `\nTIN NHẮN GẦN ĐÂY:\n${history}\n`;
  }

  prompt += `
QUY TẮC:
1. CHỈ trả lời dựa trên nội dung text đã cung cấp. Không bịa đặt.
2. Nếu không có thông tin → nói rõ "Nội dung được cung cấp không đề cập đến..."
3. Dùng markdown: **bold**, \`code\`, danh sách, code block.
4. Giải thích đơn giản, kèm ví dụ cụ thể.
5. Trả lời bằng tiếng Việt.

GIỚI HẠN:
- Không trả lời ngoài phạm vi học tập.
- Không tiết lộ thông tin cá nhân.
`;

  return prompt;
}

async function buildChatContext(
  courseId: string,
  lessonId: string | undefined,
  currentTimeSec: number | undefined,
  traceId: string,
): Promise<{ textContent: string; sources: string[] }> {
  const sources: string[] = [];
  const contentParts: string[] = [];

  // 1. Lesson content
  if (lessonId) {
    const lesson = await fetchLessonContext(lessonId, traceId);
    if (lesson?.content && lesson.content.trim().length >= MIN_CONTEXT_LENGTH) {
      contentParts.push(`[NỘI DUNG BÀI HỌC]\n${lesson.content}`);
      sources.push('LESSON_CONTENT');
    }

    // 2. Transcript (with window if currentTimeSec)
    const transcript = await fetchTranscript(lessonId, traceId);
    if (transcript?.status === 'READY' && transcript.fullText) {
      const segments = (transcript.segments || []) as { start: number; end: number; text: string }[];

      let transcriptText: string;
      if (currentTimeSec !== undefined && segments.length > 0) {
        transcriptText = getTranscriptWindow(segments, currentTimeSec);
      } else if (transcript.fullText.length <= 3000) {
        transcriptText = transcript.fullText;
      } else {
        // Truncate long transcripts
        transcriptText = transcript.fullText.slice(0, 3000);
      }

      if (transcriptText.trim().length > 0) {
        contentParts.push(`[TRANSCRIPT]\n${transcriptText}`);
        sources.push(transcript.sourceType);
      }
    }
  }

  return { textContent: contentParts.join('\n\n---\n\n'), sources };
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

    const [conversations, total] = await Promise.all([
      prisma.aiConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { messages: true } },
        },
      }),
      prisma.aiConversation.count({ where: { userId } }),
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
          select: { id: true, role: true, content: true, createdAt: true },
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
    if (effectiveLessonId) {
      const lessonContext = await fetchLessonContext(effectiveLessonId, traceId);
      if (!lessonContext || lessonContext.courseId !== conversation.courseId) {
        return res.status(403).json(createErrorResponse('Lesson does not belong to this course', 403, traceId));
      }

      const ctxStatus = await fetchAiContextStatus(effectiveLessonId, traceId);

      if (!ctxStatus.available) {
        const errorMessages: Record<string, string> = {
          TRANSCRIPT_PROCESSING: 'AI đang xử lý nội dung video. Vui lòng quay lại sau.',
          TRANSCRIPT_FAILED: 'Không thể tạo transcript tự động. Vui lòng liên hệ giảng viên.',
          NEEDS_MANUAL_TRANSCRIPT: 'Bài học chưa có transcript. Giảng viên cần bổ sung transcript hoặc subtitle.',
          VIDEO_TOO_LARGE: 'Video vượt giới hạn xử lý. Giảng viên cần chia nhỏ video.',
          NO_CONTEXT: 'AI chưa khả dụng cho bài học này vì chưa có transcript hoặc nội dung text.',
          COURSE_SERVICE_UNAVAILABLE: 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại sau.',
        };

        const message = errorMessages[ctxStatus.reason || ''] || 'AI chưa khả dụng cho bài học này.';
        return res.status(422).json(createErrorResponse(message, 422, traceId));
      }
    }

    // Save user message
    const userMessage = await prisma.aiMessage.create({
      data: {
        conversationId: id,
        role: 'user',
        content,
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

    const { textContent: contextText, sources } = await buildChatContext(
      conversation.courseId,
      effectiveLessonId ?? undefined,
      currentTimeSec,
      traceId,
    );

    if (!contextText || contextText.trim().length < MIN_CONTEXT_LENGTH) {
      // Save error message
      await prisma.aiMessage.create({
        data: {
          conversationId: id,
          role: 'assistant',
          content: 'AI chưa khả dụng cho bài học này vì chưa có đủ nội dung text để tạo context.',
          isError: true,
        },
      });
      return res.status(422).json(createErrorResponse(
        'AI chưa khả dụng cho bài học này vì chưa có transcript hoặc nội dung text.',
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

    // Stream from Gemini
    let fullResponse = '';
    let errorOccurred = false;

    try {
      for await (const chunk of streamGenerateText(content, systemPrompt)) {
        if (chunk.error) {
          errorOccurred = true;
          fullResponse = 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.';
          sendEvent('error', { message: fullResponse });
          break;
        }

        if (chunk.done) {
          sendEvent('done', { sources });
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
    const safeResponse = redactPII(fullResponse);
    await prisma.aiMessage.create({
      data: {
        conversationId: id,
        role: 'assistant',
        content: safeResponse,
        tokenCount: Math.ceil(fullResponse.length / 4),
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
