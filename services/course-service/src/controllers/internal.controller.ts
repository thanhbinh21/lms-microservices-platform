import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { logger } from '@lms/logger';
import type { Prisma } from '../generated/prisma/index.js';

/**
 * Endpoints noi bo — chi cho cac service khac trong cluster goi truc tiep
 * (khong di qua Kong). Phat hien bang header `x-internal-call`.
 *
 * Payment-service dung endpoint nay de verify price (chong client tampering).
 */

/**
 * GET /internal/courses/:id — tra ve thong tin toi thieu de tinh gia.
 */
export const getCourseByIdInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        status: true,
        instructorId: true,
        totalLessons: true,
        totalDuration: true,
        level: true,
        thumbnail: true,
      },
    });

    if (!course) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const serializedCourse = { ...course, price: course.price.toNumber() };

    const response: ApiResponse<typeof serializedCourse> = {
      success: true,
      code: 200,
      message: 'OK',
      data: serializedCourse,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getCourseByIdInternal error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal Server Error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/courses/:id/curriculum
 * Tra ve danh sach chapter + lessons cua 1 course.
 * Learning-service dung de render trang /learn.
 * Ai-service dung de lay context cho chatbot + quiz.
 */
export const getCourseCurriculumInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        level: true,
        category: { select: { name: true } },
        instructorId: true,
        chapters: {
          where: { isPublished: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            lessons: {
              where: { isPublished: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                order: true,
                content: true,
                videoUrl: true,
                sourceType: true,
                duration: true,
                isFree: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    // Build instructorName from auth-service (batch lookup)
    // For now, return instructorId — caller (ai-service) can fetch batch names
    const response: ApiResponse<{
      id: string;
      title: string;
      description: string | null;
      level: string;
      category: string;
      instructorId: string;
      instructorName?: string;
      curriculum: typeof course.chapters;
    }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: {
        id: course.id,
        title: course.title,
        description: course.description,
        level: course.level,
        category: course.category?.name || '',
        instructorId: course.instructorId,
        curriculum: course.chapters,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getCourseCurriculumInternal error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal Server Error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/lessons/:id
 * Tra ve thong tin lesson: courseId, chapterId, isFree, duration, content.
 * Learning-service dung de verify enrollment truoc khi update progress.
 * Ai-service dung de lay noi dung bai hoc lam AI context.
 */
export const getLessonByIdInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        videoUrl: true,
        sourceType: true,
        duration: true,
        isFree: true,
        chapter: {
          select: { id: true, courseId: true },
        },
      },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const data = {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      videoUrl: lesson.videoUrl,
      sourceType: lesson.sourceType,
      duration: lesson.duration,
      isFree: lesson.isFree,
      chapterId: lesson.chapter.id,
      courseId: lesson.chapter.courseId,
    };

    const response: ApiResponse<typeof data> = {
      success: true, code: 200, message: 'OK', data, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getLessonByIdInternal error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/lessons/:id/ai-context-status
 * Tra ve trang thai AI context cho 1 lesson.
 * Ai-service goi de kiem tra lesson co du context de chatbot/quiz.
 */
export const getLessonAiContextStatus = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        videoUrl: true,
        sourceType: true,
        duration: true,
        chapter: {
          select: {
            course: {
              select: { id: true, title: true, level: true, category: { select: { name: true } } },
            },
          },
        },
        transcripts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            sourceType: true,
            status: true,
            fullText: true,
            segments: true,
          },
        },
      },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const transcript = lesson.transcripts[0];
    const sources: string[] = [];

    if (lesson.content && lesson.content.trim().length >= 500) {
      sources.push('LESSON_CONTENT');
    }

    if (transcript?.status === 'READY' && transcript.fullText) {
      sources.push(transcript.sourceType);
    }

    let available = sources.length > 0;
    let reason: string | undefined;

    if (!available) {
      if (transcript?.status === 'PROCESSING') reason = 'TRANSCRIPT_PROCESSING';
      else if (transcript?.status === 'FAILED') reason = 'TRANSCRIPT_FAILED';
      else if (transcript?.status === 'NEEDS_MANUAL_TRANSCRIPT') reason = 'NEEDS_MANUAL_TRANSCRIPT';
      else if (transcript?.status === 'TOO_LARGE') reason = 'VIDEO_TOO_LARGE';
      else reason = 'NO_CONTEXT';
    }

    const response: ApiResponse<{
      available: boolean;
      sources: string[];
      transcriptStatus: string | null;
      contentLength?: number;
      reason?: string;
    }> = {
      success: true, code: 200, message: 'OK',
      data: {
        available,
        sources,
        transcriptStatus: transcript?.status ?? null,
        contentLength: lesson.content?.length || 0,
        reason,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getLessonAiContextStatus error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/lessons/:id/transcript
 * Tra ve transcript cua 1 lesson (fullText + segments).
 */
export const getLessonTranscript = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const transcript = await prisma.lessonTranscript.findFirst({
      where: { lessonId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        lessonId: true,
        sourceType: true,
        status: true,
        fullText: true,
        segments: true,
        language: true,
      },
    });

    if (!transcript) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Transcript not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof transcript> = {
      success: true, code: 200, message: 'OK', data: transcript, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getLessonTranscript error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * POST /internal/lessons/:id/transcript/manual
 * Instructor dan transcript thu cong.
 */
export const createManualTranscript = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;
  const { id } = req.params;

  try {
    const { fullText, segments, language } = req.body as {
      fullText?: string;
      segments?: unknown[];
      language?: string;
    };

    if (!fullText || fullText.trim().length < 100) {
      const response: ApiResponse<null> = {
        success: false, code: 400, message: 'Transcript must be at least 100 characters', data: null, trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    // Verify lesson ownership (instructor owns the course)
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true, chapter: { select: { course: { select: { instructorId: true } } } } },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (lesson.chapter.course.instructorId !== instructorId) {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    // Upsert transcript
    const transcript = await prisma.lessonTranscript.upsert({
      where: { id: `manual-${id}` },
      create: {
        id: `manual-${id}`,
        lessonId: id,
        sourceType: 'MANUAL',
        provider: 'manual',
        language: language || 'vi',
        status: 'READY',
        fullText,
        segments: segments as Prisma.InputJsonValue | undefined,
        generatedAt: new Date(),
      },
      update: {
        sourceType: 'MANUAL',
        provider: 'manual',
        language: language || 'vi',
        status: 'READY',
        fullText,
        segments: segments as Prisma.InputJsonValue | undefined,
        generatedAt: new Date(),
      },
    });

    logger.info({ lessonId: id, instructorId, traceId }, 'Manual transcript created');

    const response: ApiResponse<typeof transcript> = {
      success: true, code: 201, message: 'Manual transcript saved', data: transcript, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    logger.error({ err, id }, 'createManualTranscript error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * POST /internal/lessons/:id/transcript/retry
 * Retry auto transcript sau khi that bai.
 */
export const retryTranscript = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;
  const { id } = req.params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        videoUrl: true,
        sourceType: true,
        chapter: { select: { course: { select: { instructorId: true } } } },
        transcripts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (lesson.chapter.course.instructorId !== instructorId) {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    // Reset status to PENDING for retry
    const latestTranscript = lesson.transcripts[0];
    if (latestTranscript) {
      await prisma.lessonTranscript.update({
        where: { id: latestTranscript.id },
        data: { status: 'PENDING', errorCode: null, errorMessage: null },
      });
    }

    // TODO: Publish Kafka event: lesson.transcript.retry → transcript-worker
    logger.info({ lessonId: id, instructorId, traceId }, 'Transcript retry requested');

    const response: ApiResponse<{ lessonId: string; status: string }> = {
      success: true, code: 202, message: 'Transcript retry queued', data: { lessonId: id, status: 'PENDING' }, trace_id: traceId,
    };
    return res.status(202).json(response);
  } catch (err) {
    logger.error({ err, id }, 'retryTranscript error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/instructors/:instructorId/courses
 * Tra ve danh sach course IDs cua 1 instructor.
 * Community-service dung de loc cau hoi theo khoa hoc cua giang vien.
 */
export const getInstructorCourseIdsInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { instructorId } = req.params;

  try {
    const courses = await prisma.course.findMany({
      where: { instructorId },
      select: { id: true, title: true, slug: true },
    });

    const data = {
      courseIds: courses.map((c) => c.id),
      courses: courses,
    };

    const response: ApiResponse<typeof data> = {
      success: true, code: 200, message: 'OK', data, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, instructorId }, 'getInstructorCourseIdsInternal error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};
