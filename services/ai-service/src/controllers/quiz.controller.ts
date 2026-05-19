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

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_QUIZ_PER_DAY = 20;
const QUIZ_RATE_LIMIT_WINDOW = 86400; // 24 hours
const QUIZ_PASS_SCORE = 70;
const QUIZ_SESSION_EXPIRY_MINUTES = 30;
const LESSON_QUIZ_MAX_QUESTIONS = 10;
const FINAL_QUIZ_MAX_QUESTIONS = 20;

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

const QUIZ_SYSTEM_INSTRUCTION = `Ban la he thong tao quiz tu dong. Nhiem vu cua ban chi la tra ve mot JSON array, KHONG co bat ky text nao khac.
Output phai la JSON array hop le bat dau bang [ va ket thuc bang ].
Moi phan tu trong array la object co cac truong: question (string), options (array of 4 strings), correctIndex (number 0-3), explanation (string).
TUYET DOI khong viet text giai thich, khong viet 'Day la...' hay bat ky chu nao truoc hoac sau JSON array.`;

function buildLessonQuizPrompt(
  lessonTitle: string,
  textContent: string,
  courseTitle: string,
  level: string,
  count: number,
): string {
  return `Tao ${count} cau MCQ kiem tra kien thuc bai "${lessonTitle}" (khoa "${courseTitle}", trinh do ${level}).

NOI DUNG BAI HOC:
${textContent}

Yeu cau: 4 lua chon A/B/C/D, 1 dap an dung, giai thich ngan bang tieng Viet.
Chi tra ve JSON array, khong co text khac.`;
}

function buildFinalQuizPrompt(
  courseTitle: string,
  level: string,
  combinedContent: string,
  count: number,
): string {
  return `Tao ${count} cau MCQ tong hop cho khoa hoc "${courseTitle}" (trinh do ${level}).

Yeu cau dac biet:
- Bao phu nhieu bai hoc khac nhau.
- Ket hop cau hoi nho + hieu + van dung.
- Day la bai kiem tra cuoi khoa.

NOI DUNG TOAN KHOA:
${combinedContent}

Yeu cau: 4 lua chon A/B/C/D, 1 dap an dung, giai thich ngan bang tieng Viet.
Chi tra ve JSON array, khong co text khac.`;
}

function buildStaticFallbackQuiz(
  courseTitle: string,
  lessonTitle: string | undefined,
  count: number,
): QuizQuestion[] {
  const subject = lessonTitle ? `bai "${lessonTitle}"` : `khoa hoc "${courseTitle}"`;

  return Array.from({ length: count }, (_, index) => ({
    question: `Cau hoi du phong ${index + 1} cho ${subject}.`,
    options: [
      'Noi dung dang duoc cap nhat.',
      'Can xem lai bai hoc de nho hon.',
      'Vui long thu lai sau de nhan quiz day du.',
      'Lien he giang vien neu can ho tro.',
    ],
    correctIndex: 2,
    explanation: 'Quiz du phong khi he thong AI tam thoi khong san sang.',
  }));
}

async function generateQuizWithLLM(
  prompt: string,
  expectedCount: number,
): Promise<{ questions: QuizQuestion[]; raw: string }> {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Dung system instruction de ep model tra ve JSON thuần.
    const raw = await generateText(prompt, QUIZ_SYSTEM_INSTRUCTION, {
      temperature: attempt === 1 ? 0.3 : 0.1,
      maxTokens: 2048,
    });

    try {
      let jsonStr = raw.trim();
      // Strip markdown code blocks neu co.
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
      // Strip text truoc/sau JSON array.
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn({ attempt, rawPreview: raw.slice(0, 300) }, 'Quiz LLM: khong tim thay JSON array');
        if (attempt < maxAttempts) continue;
        throw new Error('LLM response khong chua JSON array');
      }

      const parsed = JSON.parse(jsonMatch[0]) as QuizQuestion[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Parsed result khong phai la array hoac rong');
      }

      const valid = parsed.filter(
        (q) => q.question && Array.isArray(q.options) && q.options.length >= 2
          && typeof q.correctIndex === 'number' && q.correctIndex >= 0,
      );

      if (valid.length === 0) {
        throw new Error('Khong co question nao hop le sau validation');
      }

      return { questions: valid, raw };
    } catch (parseErr) {
      logger.warn({ attempt, err: parseErr, rawPreview: raw.slice(0, 300) }, 'Quiz LLM: parse/validate that bai');
      if (attempt >= maxAttempts) throw parseErr;
    }
  }

  throw new Error('generateQuizWithLLM: het so lan thu');
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
          textContent = `[AUTO_CONTEXT]\n${fallback}`;
        } else {
          contextErrorCode = ctx.reason;
        }
      } else {
        textContent = ctx.textContent!;
      }
    } else {
      const ctx = await hasValidFinalQuizContext(courseId, traceId);
      if (!ctx.available) {
        const fallback = buildCourseKeywordContext(course);
        if (fallback.trim()) {
          textContent = `[AUTO_CONTEXT]\n${fallback}`;
        } else {
          contextErrorCode = ctx.reason;
        }
      } else {
        textContent = ctx.combinedContent!;
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

    textContent = `${textContent}

YEU CAU KEYWORD_EXPANSION:
- Tao quiz dua tren chu de, tu khoa, tieu de, mo ta va text giang vien cung cap.
- Duoc mo rong sang kien thuc nen tang lien quan truc tiep den khoa hoc/bai hoc.
- Khong can transcript am thanh day du.
- Tranh hoi vao chi tiet qua cu the neu ngu canh khong neu ro.`;

    let prompt: string;
    if (quizType === 'LESSON' && effectiveLessonId) {
      const lesson = course.curriculum.flatMap((ch) => ch.lessons).find((l) => l.id === effectiveLessonId);
      prompt = buildLessonQuizPrompt(
        lesson?.title || 'Bài học',
        textContent,
        course.title,
        course.level,
        effectiveCount,
      );
    } else {
      prompt = buildFinalQuizPrompt(course.title, course.level, textContent, effectiveCount);
    }

    let quizQuestions: QuizQuestion[];
    try {
      const { questions } = await generateQuizWithLLM(prompt, effectiveCount);
      quizQuestions = questions.slice(0, effectiveCount);
    } catch (err) {
      logger.warn({ err, traceId }, 'Quiz generation failed');
      // Tra loi loi thay vi quiz du phong vo nghia.
      if (isGeminiRateLimitError(err)) {
        return res.status(429).json(createErrorResponse(
          'AI đang tạm hết quota. Vui lòng thử lại sau vài phút.',
          429,
          traceId,
        ));
      }
      return res.status(503).json(createErrorResponse(
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
