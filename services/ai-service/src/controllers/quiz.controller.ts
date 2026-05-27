import { Request, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/index.js';
import { createSuccessResponse, createErrorResponse } from '@lms/types';
import { logger } from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import { handlePrismaError } from '../lib/prisma-errors.js';
import { checkRateLimit, generateText, isGeminiRateLimitError } from '../lib/gemini.js';
import { verifyEnrollment } from '../lib/access-control.js';
import { fetchCourseContext, fetchLessonAiContext, fetchCompletionStatus, fetchLessonCompletionStatus } from '../lib/course-client.js';
import { AI_SERVICE_ENV } from '../lib/env.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_QUIZ_PER_DAY = 20;
const QUIZ_RATE_LIMIT_WINDOW = 86400; // 24 hours
const QUIZ_PASS_SCORE = 70;
const QUIZ_SESSION_EXPIRY_MINUTES = 30;
const LESSON_QUIZ_MAX_QUESTIONS = 10;
const FINAL_QUIZ_MAX_QUESTIONS = 20;
const MAX_LESSON_QUIZ_CONTEXT_CHARS = 3500;
const MAX_COURSE_QUIZ_CONTEXT_CHARS = 3800;
const MAX_DESCRIPTION_CHARS = 500;
const MAX_LESSON_SUMMARY_CHARS = 180;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizQuestionClient {
  question: string;
  options: string[];
}

interface QuizCorrectData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

type CourseContext = NonNullable<Awaited<ReturnType<typeof fetchCourseContext>>>;
type LessonContext = CourseContext['curriculum'][number]['lessons'][number];

const quizQuestionSchema = z.object({
  question: z.string().trim().min(8),
  options: z.array(z.string().trim().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(3),
}).transform((item) => ({
  question: sanitizeText(item.question),
  options: item.options.map((option) => sanitizeText(option)).slice(0, 4),
  correctIndex: item.correctIndex,
  explanation: sanitizeText(item.explanation),
}));

const quizQuestionArraySchema = z.array(quizQuestionSchema).min(1).max(FINAL_QUIZ_MAX_QUESTIONS);

function sanitizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFC')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[┌┐└┘├┤┬┴┼═║╔╗╚╝]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeMultilineText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFC')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[┌┐└┘├┤┬┴┼═║╔╗╚╝]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateText(value: string | null | undefined, maxChars: number): string {
  const clean = sanitizeText(value);
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function splitSentences(value: string | null | undefined, maxSentences = 2): string {
  const clean = sanitizeText(value);
  if (!clean) return '';
  const sentences = clean.match(/[^.!?。！？]+[.!?。！？]?/g) || [clean];
  return truncateText(sentences.slice(0, maxSentences).join(' '), MAX_LESSON_SUMMARY_CHARS);
}

function extractKeywordsFromText(value: string, maxKeywords = 8): string[] {
  const ignored = new Set([
    'khoa', 'hoc', 'bai', 'chuong', 'noi', 'dung', 'giang', 'vien', 'thuc', 'hanh',
    'course', 'lesson', 'chapter', 'the', 'and', 'with', 'for', 'can', 'ban', 'mot',
  ]);

  const matches = sanitizeText(value)
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

function compactContext(value: string, maxChars: number): string {
  const clean = sanitizeMultilineText(value);
  if (clean.length <= maxChars) return clean;

  const lines = clean
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const selected: string[] = [];
  let total = 0;
  for (const line of lines) {
    const next = truncateText(line, 240);
    if (total + next.length + 1 > maxChars) break;
    selected.push(next);
    total += next.length + 1;
  }

  const result = selected.join('\n').trim();
  return result || truncateText(clean, maxChars);
}

export function buildCompactQuizContext(course: CourseContext): string {
  const contextParts: string[] = [
    `Course: ${sanitizeText(course.title)}`,
    course.description ? `Description: ${truncateText(course.description, MAX_DESCRIPTION_CHARS)}` : '',
    course.category ? `Category: ${sanitizeText(course.category)}` : '',
    course.level ? `Level: ${sanitizeText(course.level)}` : '',
  ].filter(Boolean);

  const courseKeywords = extractKeywordsFromText([
    course.title,
    course.description || '',
    ...course.curriculum.flatMap((chapter) => [
      chapter.title,
      ...chapter.lessons.flatMap((lesson) => [lesson.title, lesson.content || '']),
    ]),
  ].join(' '), 16);
  if (courseKeywords.length > 0) {
    contextParts.push(`Keywords: ${courseKeywords.join(', ')}`);
  }

  contextParts.push('Curriculum:');
  for (const chapter of course.curriculum) {
    contextParts.push(`- Chapter: ${sanitizeText(chapter.title)}`);
    for (const lesson of chapter.lessons) {
      const summary = splitSentences(lesson.content, 2);
      const lessonKeywords = extractKeywordsFromText(`${lesson.title} ${lesson.content || ''}`, 5);
      contextParts.push([
        `  - Lesson: ${sanitizeText(lesson.title)}`,
        summary ? `summary: ${summary}` : '',
        lessonKeywords.length > 0 ? `keywords: ${lessonKeywords.join(', ')}` : '',
      ].filter(Boolean).join(' | '));
    }
  }

  contextParts.push('Instruction: Generate a final course quiz from this compact metadata only. Do not require full transcripts.');
  return compactContext(contextParts.join('\n'), MAX_COURSE_QUIZ_CONTEXT_CHARS);
}

function buildLessonKeywordContext(course: CourseContext, lesson: LessonContext | undefined): string {
  const lessonChapter = lesson
    ? course.curriculum.find((chapter) => chapter.lessons.some((item) => item.id === lesson.id))
    : undefined;

  return [
    `Khoa hoc: ${course.title}`,
    course.description?.trim() ? `Mo ta khoa hoc: ${course.description.trim()}` : '',
    course.category ? `Danh muc: ${course.category}` : '',
    course.level ? `Trinh do: ${course.level}` : '',
    lessonChapter ? `Chuong: ${lessonChapter.title}` : '',
    lesson ? `Bai hoc: ${lesson.title}` : '',
    lesson?.content?.trim() ? `Noi dung giang vien: ${lesson.content.trim()}` : '',
    lesson?.videoUrl ? `Nguon video: ${lesson.sourceType} - ${lesson.videoUrl}` : '',
    lesson?.duration ? `Thoi luong: ${lesson.duration} giay` : '',
    'Che do AI: Tao cau hoi best-effort tu title, mo ta, noi dung giang vien va tu khoa lien quan truc tiep.',
  ].filter(Boolean).join('\n');
}

function buildCourseKeywordContext(course: CourseContext): string {
  const lessons = course.curriculum.flatMap((chapter) =>
    chapter.lessons.map((lesson, index) => [
      `${index + 1}. Chuong "${chapter.title}" - Bai "${lesson.title}"`,
      lesson.content?.trim() ? `Noi dung: ${lesson.content.trim()}` : '',
      lesson.videoUrl ? `Video: ${lesson.sourceType} - ${lesson.videoUrl}` : '',
    ].filter(Boolean).join('\n')),
  );

  return [
    `Khoa hoc: ${course.title}`,
    course.description?.trim() ? `Mo ta khoa hoc: ${course.description.trim()}` : '',
    course.category ? `Danh muc: ${course.category}` : '',
    course.level ? `Trinh do: ${course.level}` : '',
    lessons.join('\n\n'),
    'Che do AI: Tao quiz tong hop best-effort tu metadata, noi dung giang vien va tu khoa cua toan khoa hoc.',
  ].filter(Boolean).join('\n');
}

async function hasValidLessonQuizContext(lessonId: string, traceId: string): Promise<{
  available: boolean;
  reason?: string;
  textContent?: string;
}> {
  const aiContext = await fetchLessonAiContext(lessonId, traceId);
  if (!aiContext) {
    return { available: false, reason: 'COURSE_SERVICE_UNAVAILABLE' };
  }

  if (!aiContext.available || aiContext.textContent.trim().length === 0) {
    return { available: false, reason: 'INSUFFICIENT_CONTENT' };
  }

  return { available: true, textContent: `[${aiContext.sourceType}]\n${aiContext.textContent}` };
}

async function hasValidFinalQuizContext(courseId: string, traceId: string): Promise<{
  available: boolean;
  reason?: string;
  lessonsWithContext: number;
  totalLessons: number;
  combinedContent?: string;
}> {
  const course = await fetchCourseContext(courseId, traceId);
  if (!course || !course.curriculum) {
    return { available: false, reason: 'COURSE_NOT_FOUND', lessonsWithContext: 0, totalLessons: 0 };
  }

  const allLessons = course.curriculum.flatMap((ch) => ch.lessons);
  let lessonsWithContext = 0;
  const contentParts: string[] = [];

  if (allLessons.length === 0) {
    return { available: false, reason: 'EMPTY_COURSE', lessonsWithContext: 0, totalLessons: 0 };
  }

  const lessonContexts = await Promise.all(
    allLessons.map(async (lesson) => ({
      lesson,
      ctx: await hasValidLessonQuizContext(lesson.id, traceId),
    })),
  );

  for (const { lesson, ctx } of lessonContexts) {
    if (ctx.available && ctx.textContent) {
      lessonsWithContext++;
      contentParts.push(`[${lesson.title}]\n${ctx.textContent}`);
      continue;
    }

    // Fallback cuoi cung de final quiz khong bi chan khi context service tam thoi loi.
    const fallback = [
      `Khoa hoc: ${course.title}.`,
      course.description?.trim() ? `Mo ta khoa hoc: ${course.description.trim()}` : '',
      `Chuong: ${course.curriculum.find((chapter) => chapter.lessons.some((item) => item.id === lesson.id))?.title ?? ''}.`,
      `Tieu de bai hoc: ${lesson.title}.`,
      lesson.content?.trim() ? `Noi dung giang vien: ${lesson.content.trim()}` : '',
      lesson.videoUrl ? `Video: ${lesson.sourceType} - ${lesson.videoUrl}. Thoi luong: ${lesson.duration ?? 0} giay.` : '',
      'Ngu canh AI: Mo rong hop ly tu chu de va tu khoa lien quan.',
    ].filter(Boolean).join('\n');

    if (fallback.trim()) {
      lessonsWithContext++;
      contentParts.push(`[${lesson.title}]\n${fallback}`);
    }
  }

  if (contentParts.length === 0) {
    return {
      available: false,
      reason: 'INSUFFICIENT_CONTENT',
      lessonsWithContext,
      totalLessons: allLessons.length,
    };
  }

  return {
    available: true,
    lessonsWithContext,
    totalLessons: allLessons.length,
    combinedContent: contentParts.join('\n\n---\n\n'),
  };
}

const QUIZ_SYSTEM_INSTRUCTION = `You generate LMS multiple-choice quizzes.
Return raw JSON only. No markdown fences. No prose. No explanation outside JSON.
The response must be a valid JSON array starting with [ and ending with ].
Each item must be: {"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}.
Use Vietnamese text inside JSON string values. Escape quotes and newlines correctly.`;

function buildLessonQuizPrompt(
  lessonTitle: string,
  textContent: string,
  courseTitle: string,
  level: string,
  count: number,
): string {
  return `Return exactly ${count} MCQ questions as raw JSON array only.
Topic: lesson "${sanitizeText(lessonTitle)}" in course "${sanitizeText(courseTitle)}". Level: ${sanitizeText(level)}.

COMPACT_LESSON_CONTEXT:
${compactContext(textContent, MAX_LESSON_QUIZ_CONTEXT_CHARS)}

Rules:
- 4 options per question.
- correctIndex must be 0, 1, 2, or 3.
- Explanation is one short Vietnamese sentence.
- Output raw JSON only. No markdown. No text before or after JSON.`;
}

function buildFinalQuizPrompt(
  courseTitle: string,
  level: string,
  combinedContent: string,
  count: number,
): string {
  return `Return exactly ${count} final-course MCQ questions as raw JSON array only.
Course: "${sanitizeText(courseTitle)}". Level: ${sanitizeText(level)}.

COMPACT_COURSE_CONTEXT:
${compactContext(combinedContent, MAX_COURSE_QUIZ_CONTEXT_CHARS)}

Rules:
- Cover multiple chapters/lessons.
- Mix recall, understanding, and practical application.
- 4 options per question.
- correctIndex must be 0, 1, 2, or 3.
- Explanation is one short Vietnamese sentence.
- Output raw JSON only. No markdown. No text before or after JSON.`;
}

function buildStaticFallbackQuiz(
  courseTitle: string,
  lessonTitle: string | undefined,
  count: number,
  keywords: string[] = [],
): QuizQuestion[] {
  const subject = lessonTitle ? `bai "${lessonTitle}"` : `khoa hoc "${courseTitle}"`;
  const cleanKeywords = keywords.length > 0 ? keywords : extractKeywordsFromText(`${courseTitle} ${lessonTitle || ''}`, count + 3);
  const topicPool = cleanKeywords.length > 0 ? cleanKeywords : ['kien thuc cot loi', 'ung dung thuc te', 'quy trinh hoc tap'];

  return Array.from({ length: count }, (_, index) => ({
    question: `Trong ${subject}, khai niem "${topicPool[index % topicPool.length]}" nen duoc hieu nhu the nao?`,
    options: [
      'La mot chu de can nam vung va ap dung dung ngu canh.',
      'La noi dung phu, co the bo qua trong moi tinh huong.',
      'Chi la ten cong cu, khong lien quan den tu duy giai quyet van de.',
      'La loi he thong va khong nam trong noi dung khoa hoc.',
    ],
    correctIndex: 0,
    explanation: `Cau hoi du phong duoc tao tu metadata cua ${subject} de demo on dinh khi provider AI loi.`,
  }));
}

async function generateQuizWithLLM(
  prompt: string,
  expectedCount: number,
  retryPrompt?: string,
): Promise<{ questions: QuizQuestion[]; raw: string }> {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Dung system instruction de ep model tra ve JSON thuần.
    const activePrompt = attempt === 1 ? prompt : (retryPrompt || compactContext(prompt, 2200));
    const raw = await generateText(activePrompt, QUIZ_SYSTEM_INSTRUCTION, {
      temperature: attempt === 1 ? 0.3 : 0.1,
      maxTokens: 1400,
    });

    try {
      const jsonCandidate = extractJsonCandidate(raw);
      const parsed = JSON.parse(jsonCandidate);
      const maybeQuestions = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { questions?: unknown }).questions)
          ? (parsed as { questions: unknown[] }).questions
          : parsed;

      const validation = quizQuestionArraySchema.safeParse(maybeQuestions);
      if (!validation.success) {
        throw new Error(validation.error.issues.map((issue) => issue.message).join('; '));
      }

      return { questions: validation.data.slice(0, expectedCount), raw };
    } catch (parseErr) {
      logger.warn({ attempt, err: parseErr, rawPreview: sanitizeText(raw).slice(0, 300) }, 'Quiz LLM: parse/validate that bai');
      if (attempt >= maxAttempts) throw parseErr;
    }
  }

  throw new Error('generateQuizWithLLM: het so lan thu');
}

function stripMarkdownFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonCandidate(raw: string): string {
  const clean = stripMarkdownFences(raw).replace(/^\uFEFF/, '');
  const arrayStart = clean.indexOf('[');
  const arrayEnd = clean.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return clean.slice(arrayStart, arrayEnd + 1);
  }

  const objectStart = clean.indexOf('{');
  const objectEnd = clean.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return clean.slice(objectStart, objectEnd + 1);
  }

  throw new Error('LLM response khong chua JSON array/object');
}

function hashQuestions(questions: QuizQuestion[]): string {
  return createHash('sha256').update(JSON.stringify(questions)).digest('hex');
}

// ─── Validation Schemas ─────────────────────────────────────────────────────────

const generateQuizSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().optional(),
  quizType: z.enum(['LESSON', 'FINAL_COURSE']).default('LESSON'),
  questionCount: z.number().int().min(3).max(20).default(5),
});

const submitQuizSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(z.number().int().min(0).max(3)).min(3).max(20),
});

// ─── Controllers ───────────────────────────────────────────────────────────────

/** POST /ai/api/quiz/generate */
export async function generateQuiz(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const parsed = generateQuizSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(createErrorResponse(parsed.error.errors[0].message, 400, traceId));
    }

    const { courseId, lessonId, quizType, questionCount } = parsed.data;
    if (quizType === 'LESSON' && !lessonId) {
      return res.status(400).json(createErrorResponse('lessonId is required for lesson quiz', 400, traceId));
    }

    // Verify enrollment
    const enrolled = await verifyEnrollment(userId, courseId, traceId);
    if (!enrolled) {
      return res.status(403).json(createErrorResponse('Bạn chưa ghi danh khóa học này', 403, traceId));
    }

    // Rate limit
    const rateKey = `ratelimit:ai:quiz:${userId}`;
    const rate = await checkRateLimit(rateKey, MAX_QUIZ_PER_DAY, QUIZ_RATE_LIMIT_WINDOW);
    if (!rate.allowed) {
      return res.status(429).json(createErrorResponse(
        'Đã đạt giới hạn 20 quiz mỗi ngày. Vui lòng thử lại sau.',
        429,
        traceId,
      ));
    }

    const effectiveLessonId = quizType === 'LESSON' ? lessonId : undefined;

    // Gate: LESSON quiz chi cho phep khi bai hoc hien tai da duoc hoan thanh.
    if (quizType === 'LESSON' && effectiveLessonId) {
      const lessonDone = await fetchLessonCompletionStatus(userId, effectiveLessonId, traceId);
      // lessonDone = null nghia la learning-service khong phan hoi — cho qua de khong block.
      if (lessonDone === false) {
        return res.status(403).json(createErrorResponse(
          'Bạn cần hoàn thành bài học trước khi làm quiz.',
          403,
          traceId,
        ));
      }
    }
    const effectiveCount = Math.min(
      questionCount,
      quizType === 'FINAL_COURSE' ? FINAL_QUIZ_MAX_QUESTIONS : LESSON_QUIZ_MAX_QUESTIONS,
    );
    const course = await fetchCourseContext(courseId, traceId);
    if (!course) {
      return res.status(500).json(createErrorResponse('Không thể lấy thông tin khóa học', 500, traceId));
    }

    if (quizType === 'LESSON' && effectiveLessonId) {
      const lessonInCourse = course.curriculum.flatMap((ch) => ch.lessons).some((l) => l.id === effectiveLessonId);
      if (!lessonInCourse) {
        return res.status(403).json(createErrorResponse('Lesson does not belong to this course', 403, traceId));
      }
    }

    // Check for existing PENDING session (return same questions)
    const existingSession = await prisma.aiQuizSession.findFirst({
      where: {
        userId,
        courseId,
        quizType,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        ...(effectiveLessonId ? { lessonId: effectiveLessonId } : { lessonId: null }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSession) {
      const questions = existingSession.questions as unknown as QuizQuestionClient[];
      return res.status(200).json(createSuccessResponse({
        sessionId: existingSession.id,
        questions,
        expiresAt: existingSession.expiresAt.toISOString(),
        reused: true,
      }, 'Quiz session returned', traceId));
    }

    // Context check
    let textContent: string = '';
    let contextErrorCode: string | undefined;

    if (quizType === 'LESSON' && effectiveLessonId) {
      const ctx = await hasValidLessonQuizContext(effectiveLessonId, traceId);
      if (!ctx.available) {
        const lesson = course.curriculum.flatMap((ch) => ch.lessons).find((l) => l.id === effectiveLessonId);
        const fallback = buildLessonKeywordContext(course, lesson);
        if (fallback.trim()) {
          textContent = `[AUTO_CONTEXT]\n${compactContext(fallback, MAX_LESSON_QUIZ_CONTEXT_CHARS)}`;
        } else {
          contextErrorCode = ctx.reason;
        }
      } else {
        textContent = compactContext(ctx.textContent!, MAX_LESSON_QUIZ_CONTEXT_CHARS);
      }
    } else {
      textContent = buildCompactQuizContext(course);
      if (!textContent.trim()) {
        contextErrorCode = course.curriculum.length === 0 ? 'EMPTY_COURSE' : 'INSUFFICIENT_CONTENT';
      }
    }

    if (contextErrorCode) {
      const errorMessages: Record<string, string> = {
        TRANSCRIPT_NOT_READY: 'AI đang chuẩn bị ngữ cảnh bài học. Vui lòng quay lại sau.',
        VIDEO_TOO_LARGE: 'Video vượt giới hạn xử lý. Vui lòng chia nhỏ video.',
        INSUFFICIENT_CONTENT: 'Bài học chưa có thông tin tối thiểu để tạo quiz.',
        COURSE_SERVICE_UNAVAILABLE: 'Không thể lấy ngữ cảnh khóa học lúc này. Vui lòng thử lại sau.',
        EMPTY_COURSE: 'Khóa học chưa có bài học để tạo quiz.',
        COURSE_NOT_FOUND: 'Không tìm thấy khóa học.',
      };
      return res.status(422).json(createErrorResponse(
        errorMessages[contextErrorCode] || 'Quiz không khả dụng cho bài học này.',
        422,
        traceId,
      ));
    }

    // Check 100% completion for FINAL_COURSE quiz
    if (quizType === 'FINAL_COURSE') {
      const completion = await fetchCompletionStatus(userId, courseId, traceId);
      if (!completion || !completion.isCompleted) {
        return res.status(403).json(createErrorResponse(
          'Bạn cần hoàn thành 100% bài học trước khi làm bài kiểm tra cuối khóa.',
          403,
          traceId,
        ));
      }
    }

    // Generate quiz
    if (!course) {
      return res.status(500).json(createErrorResponse('Không thể lấy thông tin khóa học', 500, traceId));
    }

    const maxContextChars = quizType === 'FINAL_COURSE'
      ? MAX_COURSE_QUIZ_CONTEXT_CHARS
      : MAX_LESSON_QUIZ_CONTEXT_CHARS;

    textContent = compactContext(`${textContent}

YEU CAU KEYWORD_EXPANSION:
- Tao quiz dua tren chu de, tu khoa, tieu de, mo ta va text giang vien cung cap.
- Duoc mo rong sang kien thuc nen tang lien quan truc tiep den khoa hoc/bai hoc.
- Khong can transcript am thanh day du.
- Tranh hoi vao chi tiet qua cu the neu ngu canh khong neu ro.`, maxContextChars);

    let prompt: string;
    let retryPrompt: string;
    let lessonTitle: string | undefined;
    if (quizType === 'LESSON' && effectiveLessonId) {
      const lesson = course.curriculum.flatMap((ch) => ch.lessons).find((l) => l.id === effectiveLessonId);
      lessonTitle = lesson?.title;
      prompt = buildLessonQuizPrompt(
        lesson?.title || 'Bài học',
        textContent,
        course.title,
        course.level,
        effectiveCount,
      );
      retryPrompt = buildLessonQuizPrompt(
        lesson?.title || 'Bài học',
        compactContext(textContent, 1800),
        course.title,
        course.level,
        effectiveCount,
      );
    } else {
      prompt = buildFinalQuizPrompt(course.title, course.level, textContent, effectiveCount);
      retryPrompt = buildFinalQuizPrompt(course.title, course.level, compactContext(textContent, 2200), effectiveCount);
    }

    let quizQuestions: QuizQuestion[] = [];
    try {
      const { questions } = await generateQuizWithLLM(prompt, effectiveCount, retryPrompt);
      quizQuestions = questions.slice(0, effectiveCount);
    } catch (err) {
      logger.warn({ err, traceId }, 'Quiz generation failed');
      if (AI_SERVICE_ENV.AI_DEMO_FALLBACK_QUIZ.toLowerCase() === 'true') {
        const fallbackCount = Math.max(3, Math.min(5, effectiveCount));
        const keywords = extractKeywordsFromText(`${course.title} ${textContent}`, fallbackCount + 4);
        quizQuestions = buildStaticFallbackQuiz(course.title, lessonTitle, fallbackCount, keywords);
      }
      // Tra loi loi thay vi quiz du phong vo nghia.
      if (quizQuestions.length === 0 && isGeminiRateLimitError(err)) {
        return res.status(429).json(createErrorResponse(
          'AI đang tạm hết quota. Vui lòng thử lại sau vài phút.',
          429,
          traceId,
        ));
      }
      if (quizQuestions.length === 0) return res.status(503).json(createErrorResponse(
        'AI tạm thời không thể tạo quiz. Vui lòng thử lại sau.',
        503,
        traceId,
      ));
    }

    // Split: questions_client (no correct answers) vs correct_data (server-only)
    const questionsClient: QuizQuestionClient[] = quizQuestions.map((q) => ({
      question: q.question,
      options: q.options,
    }));

    const correctData: QuizCorrectData[] = quizQuestions.map((q) => ({
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    }));

    const questionsHash = hashQuestions(quizQuestions);
    const expiresAt = new Date(Date.now() + QUIZ_SESSION_EXPIRY_MINUTES * 60 * 1000);

    const session = await prisma.aiQuizSession.create({
      data: {
        userId,
        courseId,
        lessonId: effectiveLessonId || null,
        quizType,
        status: 'PENDING',
        questionsHash,
        questions: questionsClient as unknown as Prisma.InputJsonValue,
        correctData: correctData as unknown as Prisma.InputJsonValue,
        totalQ: quizQuestions.length,
        expiresAt,
      },
    });

    logger.info({ userId, courseId, quizType, sessionId: session.id, traceId }, 'Quiz generated');
    return res.status(201).json(createSuccessResponse({
      sessionId: session.id,
      questions: questionsClient,
      totalQuestions: quizQuestions.length,
      expiresAt: expiresAt.toISOString(),
    }, 'Quiz generated', traceId, 201));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'generateQuiz');
  }
}

/** POST /ai/api/quiz/submit */
export async function submitQuiz(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const parsed = submitQuizSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(createErrorResponse(parsed.error.errors[0].message, 400, traceId));
    }

    const { sessionId, answers } = parsed.data;

    // Use transaction for atomic operations
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.aiQuizSession.findUnique({ where: { id: sessionId } });

      if (!session) {
        return { error: 'NOT_FOUND', code: 404, message: 'Quiz session not found' };
      }

      if (session.userId !== userId) {
        return { error: 'FORBIDDEN', code: 403, message: 'Forbidden' };
      }

      if (session.status === 'SUBMITTED') {
        return { error: 'ALREADY_SUBMITTED', code: 409, message: 'Quiz đã được nộp rồi.' };
      }

      if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
        return { error: 'EXPIRED', code: 410, message: 'Quiz đã hết hạn (30 phút). Vui lòng tạo quiz mới.' };
      }

      const correctData = session.correctData as unknown as QuizCorrectData[];
      let correctCount = 0;

      const results = answers.map((answer, idx) => {
        const correct = correctData[idx]?.correctIndex;
        const isCorrect = answer === correct;
        if (isCorrect) correctCount++;
        return {
          questionIndex: idx,
          selected: answer,
          correct: correct,
          isCorrect,
          explanation: correctData[idx]?.explanation || '',
        };
      });

      const score = Math.round((correctCount / session.totalQ) * 100);
      const passed = score >= QUIZ_PASS_SCORE;

      await tx.aiQuizSession.update({
        where: { id: sessionId },
        data: {
          status: 'SUBMITTED',
          score,
          correctQ: correctCount,
          submittedAt: new Date(),
        },
      });

      logger.info({ userId, sessionId, score, passed, traceId }, 'Quiz submitted');

      return {
        error: null,
        score,
        correctQ: correctCount,
        totalQ: session.totalQ,
        passed,
        results,
        quizType: session.quizType,
      };
    });

    if (result.error) {
      return res.status(result.code as number).json(createErrorResponse(result.message as string, result.code as number, traceId));
    }

    return res.status(200).json(createSuccessResponse({
      score: result.score,
      correctQ: result.correctQ,
      totalQ: result.totalQ,
      passed: result.passed,
      passScore: QUIZ_PASS_SCORE,
      results: result.results,
    }, 'Quiz submitted', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'submitQuiz');
  }
}

/** GET /ai/api/quiz/history */
export async function getQuizHistory(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const courseId = req.query.courseId as string | undefined;
    const quizType = req.query.quizType as string | undefined;

    const where: Record<string, unknown> = { userId, status: 'SUBMITTED' };
    if (courseId) where.courseId = courseId;
    if (quizType) where.quizType = quizType;

    const history = await prisma.aiQuizSession.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        courseId: true,
        lessonId: true,
        quizType: true,
        score: true,
        totalQ: true,
        correctQ: true,
        submittedAt: true,
        createdAt: true,
      },
    });

    return res.status(200).json(createSuccessResponse({ history }, 'OK', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getQuizHistory');
  }
}

/** GET /ai/api/quiz/lesson/:lessonId */
export async function getLessonQuiz(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const { lessonId } = req.params;

    const session = await prisma.aiQuizSession.findFirst({
      where: { userId, lessonId, status: 'SUBMITTED' },
      orderBy: { score: 'desc' },
      select: {
        id: true,
        score: true,
        correctQ: true,
        totalQ: true,
        submittedAt: true,
        quizType: true,
      },
    });

    return res.status(200).json(createSuccessResponse(session, 'OK', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getLessonQuiz');
  }
}

/** GET /ai/api/quiz/course/:courseId/status */
export async function getCourseQuizStatus(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const userId = res.locals.userId as string;

  try {
    const { courseId } = req.params;

    const sessions = await prisma.aiQuizSession.findMany({
      where: { userId, courseId, quizType: 'FINAL_COURSE', status: 'SUBMITTED' },
      orderBy: { score: 'desc' },
      select: { id: true, score: true, correctQ: true, totalQ: true, submittedAt: true },
    });

    const bestScore = sessions[0]?.score || 0;
    const passed = bestScore >= QUIZ_PASS_SCORE;
    const attemptCount = sessions.length;

    return res.status(200).json(createSuccessResponse({
      bestScore,
      passed,
      attemptCount,
      passedAt: passed ? sessions[0]?.submittedAt : null,
    }, 'OK', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getCourseQuizStatus');
  }
}

/** GET /internal/quiz/check — Called by learning-service for certificate gate */
export async function checkQuizPassedInternal(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();

  try {
    const userId = req.query.userId as string;
    const courseId = req.query.courseId as string;

    if (!userId || !courseId) {
      return res.status(400).json(createErrorResponse('userId and courseId are required', 400, traceId));
    }

    const sessions = await prisma.aiQuizSession.findMany({
      where: { userId, courseId, quizType: 'FINAL_COURSE', status: 'SUBMITTED' },
      select: { score: true },
      orderBy: { score: 'desc' },
    });

    const bestScore = sessions[0]?.score || 0;
    const passed = bestScore >= QUIZ_PASS_SCORE;

    return res.status(200).json(createSuccessResponse({
      passed,
      bestScore,
      attemptCount: sessions.length,
    }, 'OK', traceId));
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'checkQuizPassedInternal');
  }
}
