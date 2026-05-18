import { Request, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/index.js';
import { createSuccessResponse, createErrorResponse } from '@lms/types';
import { logger } from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import { handlePrismaError } from '../lib/prisma-errors.js';
import { checkRateLimit } from '../lib/gemini.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { generateText } from '../lib/gemini.js';
import { verifyEnrollment } from '../lib/access-control.js';
import { fetchAiContextStatus, fetchTranscript, fetchCourseContext, fetchLessonContext, fetchCompletionStatus } from '../lib/course-client.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_QUIZ_PER_DAY = 20;
const QUIZ_RATE_LIMIT_WINDOW = 86400; // 24 hours
const MIN_QUIZ_CONTEXT_LENGTH = 1000;
const MIN_FINAL_QUIZ_COVERAGE = 0.5;
const QUIZ_PASS_SCORE = 70;
const QUIZ_SESSION_EXPIRY_MINUTES = 30;
const LESSON_QUIZ_DEFAULT_QUESTIONS = 5;
const LESSON_QUIZ_MAX_QUESTIONS = 10;
const FINAL_QUIZ_DEFAULT_QUESTIONS = 15;
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

async function hasValidLessonQuizContext(lessonId: string, traceId: string): Promise<{
  available: boolean;
  reason?: string;
  textContent?: string;
}> {
  const ctxStatus = await fetchAiContextStatus(lessonId, traceId);

  if (ctxStatus.transcriptStatus === 'PROCESSING') return { available: false, reason: 'TRANSCRIPT_NOT_READY' };
  if (ctxStatus.transcriptStatus === 'TOO_LARGE') return { available: false, reason: 'VIDEO_TOO_LARGE' };

  const lesson = await fetchLessonContext(lessonId, traceId);
  const transcript = await fetchTranscript(lessonId, traceId);

  const contentParts: string[] = [];
  if (lesson?.content && lesson.content.trim().length >= MIN_QUIZ_CONTEXT_LENGTH) {
    contentParts.push(lesson.content);
  }
  if (transcript?.status === 'READY' && transcript.fullText) {
    contentParts.push(transcript.fullText);
  }

  const combined = contentParts.join('\n\n');
  if (combined.length < MIN_QUIZ_CONTEXT_LENGTH) {
    return { available: false, reason: 'INSUFFICIENT_CONTENT' };
  }

  return { available: true, textContent: combined };
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

  for (const lesson of allLessons) {
    const ctx = await hasValidLessonQuizContext(lesson.id, traceId);
    if (ctx.available && ctx.textContent) {
      lessonsWithContext++;
      contentParts.push(`[${lesson.title}]\n${ctx.textContent}`);
    }
  }

  const coverage = allLessons.length > 0 ? lessonsWithContext / allLessons.length : 0;
  if (coverage < MIN_FINAL_QUIZ_COVERAGE) {
    return {
      available: false,
      reason: 'INSUFFICIENT_COURSE_COVERAGE',
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

function buildLessonQuizPrompt(
  lessonTitle: string,
  textContent: string,
  courseTitle: string,
  level: string,
  count: number,
): string {
  return `Tạo ${count} câu MCQ kiểm tra kiến thức bài "${lessonTitle}" (khóa "${courseTitle}", ${level}).

NỘI DUNG:
${textContent}

QUY TẮC: 4 lựa chọn, 1 đáp án đúng, giải thích ngắn, tiếng Việt, JSON thuần.
OUTPUT: [{ "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." }]
Không có gì khác ngoài JSON array.`;
}

function buildFinalQuizPrompt(
  courseTitle: string,
  level: string,
  combinedContent: string,
  count: number,
): string {
  return `Tạo ${count} câu MCQ tổng hợp cho TOÀN BỘ khóa học "${courseTitle}" (${level}).

YÊU CẦU ĐẶC BIỆT:
- Bao phủ nhiều bài học khác nhau (không tập trung 1 bài).
- Kết hợp câu hỏi nhớ + hiểu + vận dụng.
- Độ khó phù hợp ${level}.
- Đây là bài kiểm tra cuối khóa để nhận chứng chỉ.

NỘI DUNG TOÀN KHÓA:
${combinedContent}

QUY TẮC: 4 lựa chọn, 1 đáp án đúng, giải thích ngắn, tiếng Việt, JSON thuần.
OUTPUT: [{ "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." }]
Không có gì khác ngoài JSON array.`;
}

async function generateQuizWithLLM(
  prompt: string,
  expectedCount: number,
): Promise<{ questions: QuizQuestion[]; raw: string }> {
  const raw = await generateText(prompt, undefined, {
    temperature: 0.7,
    maxTokens: 4096,
  });

  // Extract JSON array from response
  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonStr) as QuizQuestion[];
  return { questions: parsed, raw };
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
        contextErrorCode = ctx.reason;
      } else {
        textContent = ctx.textContent!;
      }
    } else {
      const ctx = await hasValidFinalQuizContext(courseId, traceId);
      if (!ctx.available) {
        contextErrorCode = ctx.reason;
      } else {
        textContent = ctx.combinedContent!;
      }
    }

    if (contextErrorCode) {
      const errorMessages: Record<string, string> = {
        TRANSCRIPT_NOT_READY: 'AI đang xử lý transcript cho video này. Vui lòng quay lại sau.',
        VIDEO_TOO_LARGE: 'Video vượt giới hạn xử lý. Vui lòng chia nhỏ video.',
        INSUFFICIENT_CONTENT: 'Bài học chưa có đủ nội dung text (tối thiểu 1000 ký tự) để tạo quiz.',
        INSUFFICIENT_COURSE_COVERAGE: 'Chưa đủ bài học có nội dung text (cần ≥50% bài học). Giảng viên cần bổ sung transcript.',
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
    const courseForPrompt = course;
    if (!course) {
      return res.status(500).json(createErrorResponse('Không thể lấy thông tin khóa học', 500, traceId));
    }

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
      return res.status(500).json(createErrorResponse('Không thể tạo quiz. Vui lòng thử lại.', 500, traceId));
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
