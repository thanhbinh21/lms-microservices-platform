import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createLessonSchema = z.object({
  title: z.string().min(2, 'Lesson title must be at least 2 characters'),
  isFree: z.boolean().default(false),
});

const updateLessonSchema = z.object({
  title: z.string().min(2).optional(),
  videoUrl: z.string().url('Invalid video URL').optional(),
  duration: z.number().int().min(0).optional(), // seconds
  isPublished: z.boolean().optional(),
  isFree: z.boolean().optional(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function verifyChapterOwnership(courseId: string, chapterId: string, instructorId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: 'Course not found', status: 404 };
  if (course.instructorId !== instructorId) return { error: 'Forbidden — not your course', status: 403 };

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId, courseId } });
  if (!chapter) return { error: 'Chapter not found', status: 404 };

  return { course, chapter };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/courses/:courseId/chapters/:chapterId/lessons
 * Instructor — add a lesson to a chapter
 */
export async function createLesson(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  const instructorId = req.headers['x-user-id'] as string;

  try {
    const { error, status } = await verifyChapterOwnership(req.params.courseId, req.params.chapterId, instructorId);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const validated = createLessonSchema.parse(req.body);

    // Auto-assign order (append to end)
    const lastLesson = await prisma.lesson.findFirst({
      where: { chapterId: req.params.chapterId },
      orderBy: { order: 'desc' },
    });
    const order = (lastLesson?.order ?? -1) + 1;

    const lesson = await prisma.lesson.create({
      data: {
        title: validated.title,
        isFree: validated.isFree,
        order,
        chapterId: req.params.chapterId,
      },
    });

    // Update course totalLessons count
    await prisma.course.update({
      where: { id: req.params.courseId },
      data: { totalLessons: { increment: 1 } },
    });

    const response: ApiResponse<typeof lesson> = {
      success: true, code: 201, message: 'Lesson created successfully', data: lesson, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    logger.error({ err }, 'createLesson error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to create lesson', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * PUT /api/courses/:courseId/chapters/:chapterId/lessons/:lessonId
 * Instructor — update lesson content (including video URL from Phase 6)
 */
export async function updateLesson(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  const instructorId = req.headers['x-user-id'] as string;

  try {
    const { error, status } = await verifyChapterOwnership(req.params.courseId, req.params.chapterId, instructorId);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const validated = updateLessonSchema.parse(req.body);

    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId, chapterId: req.params.chapterId },
      data: validated,
    });

    // Update course totalDuration if duration changed
    if (validated.duration !== undefined) {
      const allLessons = await prisma.lesson.findMany({ where: { chapter: { courseId: req.params.courseId } } });
      const totalDuration = allLessons.reduce((acc, l) => acc + l.duration, 0);
      await prisma.course.update({ where: { id: req.params.courseId }, data: { totalDuration } });
    }

    const response: ApiResponse<typeof lesson> = {
      success: true, code: 200, message: 'Lesson updated successfully', data: lesson, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    logger.error({ err }, 'updateLesson error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to update lesson', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * DELETE /api/courses/:courseId/chapters/:chapterId/lessons/:lessonId
 * Instructor — delete a lesson
 */
export async function deleteLesson(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  const instructorId = req.headers['x-user-id'] as string;

  try {
    const { error, status } = await verifyChapterOwnership(req.params.courseId, req.params.chapterId, instructorId);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    await prisma.lesson.delete({
      where: { id: req.params.lessonId, chapterId: req.params.chapterId },
    });

    // Decrement course totalLessons count
    await prisma.course.update({
      where: { id: req.params.courseId },
      data: { totalLessons: { decrement: 1 } },
    });

    const response: ApiResponse<null> = {
      success: true, code: 200, message: 'Lesson deleted successfully', data: null, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'deleteLesson error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to delete lesson', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}
