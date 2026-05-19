import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma.js';
import { getCourseById, getLessonById, getCourseCurriculum, type ChapterWithLessons } from '../lib/course-client.js';

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:3008').replace(/\/$/, '');
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createCertificateNumber(): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `LMS-${y}${m}${d}-${suffix}`;
}

// Kiem tra final course quiz da passed chua (goi ai-service).
// KHONG co graceful fallback — certificate chi duoc cap khi quiz passed va ai-service available.
async function checkFinalQuizPassed(userId: string, courseId: string): Promise<{
  passed: boolean;
  bestScore: number;
  attemptCount: number;
  serviceAvailable: boolean;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `${AI_SERVICE_URL}/internal/quiz/check?userId=${userId}&courseId=${courseId}`,
      {
        headers: {
          'x-internal-call': 'learning-service',
          'x-internal-secret': INTERNAL_SERVICE_SECRET,
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    if (!res.ok) {
      logger.warn({ userId, courseId, status: res.status }, 'checkFinalQuizPassed: ai-service returned error');
      return { passed: false, bestScore: 0, attemptCount: 0, serviceAvailable: false };
    }

    const json = (await res.json()) as { data?: { passed: boolean; bestScore: number; attemptCount: number } };
    const data = json.data ?? { passed: false, bestScore: 0, attemptCount: 0 };
    return { ...data, serviceAvailable: true };
  } catch (err) {
    logger.warn({ err, userId, courseId }, 'checkFinalQuizPassed: ai-service unavailable');
    return { passed: false, bestScore: 0, attemptCount: 0, serviceAvailable: false };
  }
}

// Tinh progress dua tren lessonProgress cua user cho 1 course
async function computeCourseCompletion(userId: string, courseId: string, totalLessons: number) {
  const completedLessons = await prisma.lessonProgress.count({
    where: { userId, courseId, isCompleted: true },
  });

  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isCompleted = totalLessons > 0 && completedLessons >= totalLessons;

  return { totalLessons, completedLessons, progressPercent, isCompleted };
}

// Phat chung chi neu du dieu kien: 100% lessons + final quiz passed (khong fallback).
async function issueCertificateIfEligible(params: {
  userId: string;
  courseId: string;
  enrollmentId: string;
  totalLessons: number;
}) {
  const { userId, courseId, enrollmentId, totalLessons } = params;
  const completion = await computeCourseCompletion(userId, courseId, totalLessons);

  if (!completion.isCompleted) {
    return {
      issued: false,
      certificates: [],
      completion,
      reason: 'NOT_COMPLETED',
      quizResult: null,
    };
  }

  // Kiem tra final quiz — STRICT, khong fallback
  const quizResult = await checkFinalQuizPassed(userId, courseId);

  if (!quizResult.serviceAvailable) {
    return {
      issued: false,
      certificates: [],
      completion,
      reason: 'AI_SERVICE_UNAVAILABLE',
      message: 'Hệ thống kiểm tra tạm thời không khả dụng. Vui lòng thử lại sau.',
      quizResult,
    };
  }

  if (!quizResult.passed) {
    return {
      issued: false,
      certificates: [],
      completion,
      reason: 'QUIZ_NOT_PASSED',
      quizRequired: true,
      quizBestScore: quizResult.bestScore,
      quizAttemptCount: quizResult.attemptCount,
      quizResult,
    };
  }

  // Kiem tra da co chung chi chua (idempotent)
  const existed = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  if (existed) {
    return { issued: false, certificates: [existed], completion, reason: 'ALREADY_ISSUED', quizResult };
  }

  const cert = await prisma.certificate.create({
    data: {
      userId,
      courseId,
      enrollmentId,
      certificateNumber: createCertificateNumber(),
      completedAt: new Date(),
    },
  });

  logger.info({ userId, courseId, certificateId: cert.id }, 'Certificate issued after final quiz passed');
  return { issued: true, certificates: [cert], completion, reason: 'ISSUED', quizResult };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/learn/:courseId
 * Lay du lieu hoc tap: chapters, lessons, progress cua user
 * Course data lay tu course-service internal API
 */
export const getLearnData = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    // Lay course data, curriculum, va user progress song song
    const [course, curriculum, userProgresses] = await Promise.all([
      getCourseById(courseId),
      getCourseCurriculum(courseId),
      prisma.lessonProgress.findMany({
        where: { userId, courseId },
        select: {
          lessonId: true,
          isCompleted: true,
          lastWatched: true,
          updatedAt: true,
        },
      }),
    ]);

    if (!course) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Không tìm thấy khóa học', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const progressMap = new Map(userProgresses.map((p) => [p.lessonId, p]));
    const completedCount = userProgresses.filter((p) => p.isCompleted).length;
    const totalLessons = course.totalLessons || 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    // Neu khong co curriculum (course chua co chapter), tra ve mang rong
    if (!curriculum) {
      const data = {
        course,
        enrolled: !!enrollment,
        chapters: [],
        progressPercent,
        completedLessons: completedCount,
        totalLessons,
      };
      const response: ApiResponse<typeof data> = {
        success: true, code: 200, message: 'OK', data, trace_id: traceId,
      };
      return res.status(200).json(response);
    }

    // Merge progress vao lessons, derive contentType
    const chapters = curriculum.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      order: chapter.order,
      lessons: chapter.lessons.map((lesson) => {
        const lessonProgress = progressMap.get(lesson.id);
        let contentType: 'TEXT' | 'VIDEO' | 'YOUTUBE' | null = null;
        if (lesson.videoUrl) {
          contentType = lesson.sourceType === 'YOUTUBE' ? 'YOUTUBE' : 'VIDEO';
        } else if (lesson.content) {
          contentType = 'TEXT';
        }
        return {
          id: lesson.id,
          title: lesson.title,
          order: lesson.order,
          content: lesson.content,
          contentType,
          videoUrl: lesson.videoUrl,
          sourceType: lesson.sourceType,
          duration: lesson.duration,
          isFree: lesson.isFree,
          progress: lessonProgress
            ? {
                lessonId: lesson.id,
                isCompleted: lessonProgress.isCompleted,
                lastWatched: lessonProgress.lastWatched,
                updatedAt: lessonProgress.updatedAt,
              }
            : null,
        };
      }),
    }));

    const data = {
      course,
      enrolled: !!enrollment,
      chapters,
      progressPercent,
      completedLessons: completedCount,
      totalLessons,
    };

    const response: ApiResponse<typeof data> = {
      success: true, code: 200, message: 'OK', data, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, courseId, traceId }, 'getLearnData failed');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /api/courses/:courseId/progress
 * Lay tien do hoc tap cua user theo course
 */
export const getCourseProgress = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (!enrollment) {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Bạn chưa ghi danh khóa học này',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const progressList = await prisma.lessonProgress.findMany({
      where: { userId, courseId },
      select: {
        lessonId: true,
        isCompleted: true,
        lastWatched: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const response: ApiResponse<typeof progressList> = {
      success: true,
      code: 200,
      message: 'OK',
      data: progressList,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, courseId, traceId }, 'getCourseProgress failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Lỗi hệ thống',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * POST /api/lessons/:lessonId/complete
 * Danh dau bai hoc hoan thanh, kiem tra va cap chung chi neu du dieu kien
 */
export const completeLesson = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { lessonId } = req.params;

  try {
    // Lay thong tin lesson tu course-service
    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Không tìm thấy bài học', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const { courseId } = lesson;

    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Bạn chưa ghi danh khóa học này', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    // Upsert lesson progress
    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, courseId, enrollmentId: enrollment.id, isCompleted: true, lastWatched: 0 },
      update: { isCompleted: true },
    });

    // Lay course info de tinh toan completion
    const course = await getCourseById(courseId);
    const totalLessons = course?.totalLessons || 0;

    const certResult = await issueCertificateIfEligible({
      userId,
      courseId,
      enrollmentId: enrollment.id,
      totalLessons,
    });

    const response: ApiResponse<{
      progress: typeof progress;
      courseCompleted: boolean;
      progressPercent: number;
      certificate: (typeof certResult.certificates)[0] | null;
      certificateBlockedReason?: string;
      quizBestScore?: number;
      quizAttemptCount?: number;
    }> = {
      success: true,
      code: 200,
      message: certResult.issued ? 'Hoàn thành bài học và nhận chứng chỉ!' : 'Hoàn thành bài học',
      data: {
        progress,
        courseCompleted: certResult.completion.isCompleted,
        progressPercent: certResult.completion.progressPercent,
        certificate: certResult.certificates[0] ?? null,
        ...(certResult.reason === 'AI_SERVICE_UNAVAILABLE' && {
          certificateBlockedReason: certResult.message,
        }),
        ...(certResult.reason === 'QUIZ_NOT_PASSED' && {
          certificateBlockedReason: 'Bạn cần đạt điểm ≥70% trong bài kiểm tra cuối khóa để nhận chứng chỉ.',
          quizBestScore: certResult.quizBestScore ?? 0,
          quizAttemptCount: certResult.quizAttemptCount ?? 0,
        }),
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, lessonId, traceId }, 'completeLesson failed');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * POST /api/lessons/:lessonId/progress
 * Cap nhat thoi gian xem video (partial progress)
 */
export const updateLessonProgress = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { lessonId } = req.params;
  const { lastWatched } = req.body;

  try {
    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Không tìm thấy bài học', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.courseId } },
    });
    if (!enrollment) {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Chưa ghi danh khóa học', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, courseId: lesson.courseId, enrollmentId: enrollment.id, lastWatched: lastWatched || 0 },
      update: { lastWatched: lastWatched || 0 },
    });

    const response: ApiResponse<typeof progress> = {
      success: true, code: 200, message: 'Đã lưu tiến độ', data: progress, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, lessonId, traceId }, 'updateLessonProgress failed');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /api/certificates
 * Lay danh sach chung chi cua user
 */
export const getMyCertificates = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const certificates = await prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });

    // Lay course info cho tung chung chi (parallel, best-effort)
    const courseDetails: Record<string, any> = {};
    await Promise.allSettled(
      certificates.map(async (c) => {
        const course = await getCourseById(c.courseId);
        if (course) courseDetails[c.courseId] = course;
      }),
    );

    const result = certificates.map((c) => ({
      ...c,
      course: courseDetails[c.courseId] || { id: c.courseId },
    }));

    const response: ApiResponse<typeof result> = {
      success: true, code: 200, message: 'Danh sách chứng chỉ', data: result, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'getMyCertificates failed');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /api/certificates/:certificateNumber
 * Xem chi tiet chung chi (public — ai cung xem duoc de verify)
 */
export const getCertificateByNumber = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { certificateNumber } = req.params;

  try {
    const cert = await prisma.certificate.findFirst({
      where: { certificateNumber },
    });

    if (!cert) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Không tìm thấy chứng chỉ', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (cert.userId !== userId) {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const course = await getCourseById(cert.courseId);

    const response: ApiResponse<typeof cert & { course: typeof course }> = {
      success: true, code: 200, message: 'OK', data: { ...cert, course }, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, certificateNumber, traceId }, 'getCertificateByNumber failed');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/enrollment/check?userId=&courseId=
 * Internal API — community-service goi de check enrollment (khong qua Gateway)
 */
export const internalCheckEnrollment = async (req: Request, res: Response): Promise<Response | void> => {
  const { userId, courseId } = req.query;
  if (!userId || !courseId) {
    return res.status(400).json({ success: false, message: 'Missing userId or courseId' });
  }

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: userId as string, courseId: courseId as string } },
      select: { id: true },
    });

    return res.status(200).json({ success: true, data: { enrolled: !!enrollment } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
};

/**
 * GET /internal/courses/:courseId/completion?userId=
 * Internal API — course-service goi de kiem tra tien do hoc tap
 */
export const internalGetCourseCompletion = async (req: Request, res: Response): Promise<Response | void> => {
  const { courseId } = req.params;
  const { userId } = req.query;

  if (!userId || !courseId) {
    return res.status(400).json({ success: false, message: 'Missing userId or courseId' });
  }

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: userId as string, courseId } },
      select: { id: true },
    });

    if (!enrollment) {
      return res.status(200).json({
        success: true,
        data: {
          enrolled: false,
          totalLessons: 0,
          completedLessons: 0,
          progressPercent: 0,
          completed: false,
        },
      });
    }

    const course = await getCourseById(courseId);
    const totalLessons = course?.totalLessons || 0;
    const completion = await computeCourseCompletion(userId as string, courseId, totalLessons);

    return res.status(200).json({
      success: true,
      data: {
        enrolled: true,
        ...completion,
        completed: completion.isCompleted,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
};
/**
 * GET /internal/lessons/:lessonId/completion?userId=
 * Internal API — ai-service goi de kiem tra bai hoc da hoan thanh chua truoc khi tao quiz.
 */
export const internalCheckLessonCompletion = async (req: Request, res: Response): Promise<Response | void> => {
  const { lessonId } = req.params;
  const { userId } = req.query;

  if (!userId || !lessonId) {
    return res.status(400).json({ success: false, message: 'Missing userId or lessonId' });
  }

  try {
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: userId as string, lessonId } },
      select: { isCompleted: true },
    });

    return res.status(200).json({
      success: true,
      data: { isCompleted: progress?.isCompleted ?? false },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
};
