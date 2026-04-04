import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createLessonSchema = z.object({
  title: z.string().min(2, 'Lesson title must be at least 2 characters'),
  isFree: z.boolean().default(false),
  sourceType: z.enum(['UPLOAD', 'YOUTUBE']).default('UPLOAD'),
  videoUrl: z.string().url('Invalid video URL').optional(),
});

const updateLessonSchema = z.object({
  title: z.string().min(2).optional(),
  videoUrl: z.string().url('Invalid video URL').optional(),
  sourceType: z.enum(['UPLOAD', 'YOUTUBE']).optional(),
  duration: z.number().int().min(0).optional(), // seconds
  isPublished: z.boolean().optional(),
  isFree: z.boolean().optional(),
});

function isYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

function inferSourceType(videoUrl?: string | null): 'UPLOAD' | 'YOUTUBE' {
  return videoUrl && isYoutubeUrl(videoUrl) ? 'YOUTUBE' : 'UPLOAD';
}

function validateLessonVideoSource(sourceType: 'UPLOAD' | 'YOUTUBE', videoUrl?: string) {
  if (sourceType === 'YOUTUBE') {
    if (!videoUrl) {
      return 'YouTube lesson requires videoUrl';
    }
    if (!isYoutubeUrl(videoUrl)) {
      return 'YouTube lesson must use youtube.com or youtu.be URL';
    }
  }
  return null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

// Kiem tra quyen so huu chapter, admin co the bypass
async function verifyChapterOwnership(courseId: string, chapterId: string, instructorId: string, userRole?: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: 'Course not found', status: 404 };
  if (course.instructorId !== instructorId && userRole?.toLowerCase() !== 'admin') return { error: 'Forbidden — not your course', status: 403 };

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId, courseId } });
  if (!chapter) return { error: 'Chapter not found', status: 404 };

  return { course, chapter };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/** POST - Them bai hoc vao chuong */
export async function createLesson(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const { error, status } = await verifyChapterOwnership(req.params.courseId, req.params.chapterId, instructorId, userRole);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const validated = createLessonSchema.parse(req.body);
    const sourceError = validateLessonVideoSource(validated.sourceType, validated.videoUrl);
    if (sourceError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: sourceError, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }

    // Tu dong gan thu tu (them vao cuoi)
    const lastLesson = await prisma.lesson.findFirst({
      where: { chapterId: req.params.chapterId },
      orderBy: { order: 'desc' },
    });
    const order = (lastLesson?.order ?? -1) + 1;

    const lesson = await prisma.lesson.create({
      data: {
        title: validated.title,
        isFree: validated.isFree,
        videoUrl: validated.videoUrl,
        order,
        chapterId: req.params.chapterId,
      },
    });

    const lessonResponse = {
      ...lesson,
      sourceType: inferSourceType(lesson.videoUrl),
    };

    // Cap nhat tong so bai hoc
    await prisma.course.update({
      where: { id: req.params.courseId },
      data: { totalLessons: { increment: 1 } },
    });

    const response: ApiResponse<typeof lessonResponse> = {
      success: true, code: 201, message: 'Lesson created successfully', data: lessonResponse, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    return handlePrismaError(err, res, traceId, 'createLesson');
  }
}

/** PUT - Cap nhat bai hoc */
export async function updateLesson(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const { error, status } = await verifyChapterOwnership(req.params.courseId, req.params.chapterId, instructorId, userRole);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const validated = updateLessonSchema.parse(req.body);

    const currentLesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId, chapterId: req.params.chapterId },
      select: { videoUrl: true },
    });

    if (!currentLesson) {
      const response: ApiResponse<null> = { success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId };
      return res.status(404).json(response);
    }

    const nextSourceType = validated.sourceType ?? inferSourceType(currentLesson.videoUrl);
    const nextVideoUrl = validated.videoUrl ?? currentLesson.videoUrl ?? undefined;
    const sourceError = validateLessonVideoSource(nextSourceType, nextVideoUrl || undefined);
    if (sourceError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: sourceError, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }

    const { sourceType: _sourceType, ...updateData } = validated;

    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId, chapterId: req.params.chapterId },
      data: updateData,
    });

    const lessonResponse = {
      ...lesson,
      sourceType: inferSourceType(lesson.videoUrl),
    };

    // Cap nhat tong thoi luong neu duration thay doi (dung aggregate thay vi N+1)
    if (validated.duration !== undefined) {
      const result = await prisma.lesson.aggregate({
        where: { chapter: { courseId: req.params.courseId } },
        _sum: { duration: true },
      });
      await prisma.course.update({
        where: { id: req.params.courseId },
        data: { totalDuration: result._sum.duration || 0 },
      });
    }

    const response: ApiResponse<typeof lessonResponse> = {
      success: true, code: 200, message: 'Lesson updated successfully', data: lessonResponse, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    return handlePrismaError(err, res, traceId, 'updateLesson');
  }
}

/** DELETE - Xoa bai hoc */
export async function deleteLesson(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const { error, status } = await verifyChapterOwnership(req.params.courseId, req.params.chapterId, instructorId, userRole);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    await prisma.lesson.delete({
      where: { id: req.params.lessonId, chapterId: req.params.chapterId },
    });

    // Giam so bai hoc
    await prisma.course.update({
      where: { id: req.params.courseId },
      data: { totalLessons: { decrement: 1 } },
    });

    const response: ApiResponse<null> = {
      success: true, code: 200, message: 'Lesson deleted successfully', data: null, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteLesson');
  }
}

/** GET /api/lessons/:lessonId/playback - Lay URL phat video sau khi kiem tra quyen truy cap */
export async function getLessonPlayback(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = (req.headers['x-user-id'] as string) || '';

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: {
        chapter: {
          include: {
            course: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      const notFound: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    if (!lesson.isPublished || !lesson.chapter.isPublished || lesson.chapter.course.status !== 'PUBLISHED') {
      const forbidden: ApiResponse<null> = {
        success: false, code: 403, message: 'Lesson is not available for playback', data: null, trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    if (!lesson.videoUrl) {
      const bad: ApiResponse<null> = {
        success: false, code: 400, message: 'Lesson has no video source', data: null, trace_id: traceId,
      };
      return res.status(400).json(bad);
    }

    if (!lesson.isFree) {
      if (!userId) {
        const unauthorized: ApiResponse<null> = {
          success: false, code: 401, message: 'Login required for paid lesson playback', data: null, trace_id: traceId,
        };
        return res.status(401).json(unauthorized);
      }

      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: lesson.chapter.courseId,
          },
        },
      });

      if (!enrollment) {
        const forbidden: ApiResponse<null> = {
          success: false, code: 403, message: 'You are not enrolled in this course', data: null, trace_id: traceId,
        };
        return res.status(403).json(forbidden);
      }
    }

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Playback URL fetched successfully',
      data: {
        lessonId: lesson.id,
        courseId: lesson.chapter.courseId,
        videoUrl: lesson.videoUrl,
        sourceType: inferSourceType(lesson.videoUrl),
        isFree: lesson.isFree,
        duration: lesson.duration,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getLessonPlayback');
  }
}
