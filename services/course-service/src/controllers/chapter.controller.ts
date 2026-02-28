import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createChapterSchema = z.object({
  title: z.string().min(2, 'Chapter title must be at least 2 characters'),
});

const updateChapterSchema = z.object({
  title: z.string().min(2).optional(),
  isPublished: z.boolean().optional(),
});

const reorderSchema = z.object({
  chapters: z.array(z.object({ id: z.string().uuid(), order: z.number().int().min(0) })),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function verifyCourseOwnership(courseId: string, instructorId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: 'Course not found', status: 404 };
  if (course.instructorId !== instructorId) return { error: 'Forbidden — not your course', status: 403 };
  return { course };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/courses/:courseId/chapters
 * Instructor — add a chapter to a course
 */
export async function createChapter(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  const instructorId = req.headers['x-user-id'] as string;

  try {
    const { error, status } = await verifyCourseOwnership(req.params.courseId, instructorId);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const validated = createChapterSchema.parse(req.body);

    // Auto-assign order (append to end)
    const lastChapter = await prisma.chapter.findFirst({
      where: { courseId: req.params.courseId },
      orderBy: { order: 'desc' },
    });
    const order = (lastChapter?.order ?? -1) + 1;

    const chapter = await prisma.chapter.create({
      data: {
        title: validated.title,
        order,
        courseId: req.params.courseId,
      },
    });

    const response: ApiResponse<typeof chapter> = {
      success: true, code: 201, message: 'Chapter created successfully', data: chapter, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    logger.error({ err }, 'createChapter error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to create chapter', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * PUT /api/courses/:courseId/chapters/:chapterId
 * Instructor — update chapter title or publish status
 */
export async function updateChapter(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  const instructorId = req.headers['x-user-id'] as string;

  try {
    const { error, status } = await verifyCourseOwnership(req.params.courseId, instructorId);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const validated = updateChapterSchema.parse(req.body);

    const chapter = await prisma.chapter.update({
      where: { id: req.params.chapterId, courseId: req.params.courseId },
      data: validated,
    });

    const response: ApiResponse<typeof chapter> = {
      success: true, code: 200, message: 'Chapter updated successfully', data: chapter, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    logger.error({ err }, 'updateChapter error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to update chapter', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * DELETE /api/courses/:courseId/chapters/:chapterId
 * Instructor — delete a chapter (cascades to lessons)
 */
export async function deleteChapter(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  const instructorId = req.headers['x-user-id'] as string;

  try {
    const { error, status } = await verifyCourseOwnership(req.params.courseId, instructorId);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    await prisma.chapter.delete({
      where: { id: req.params.chapterId, courseId: req.params.courseId },
    });

    const response: ApiResponse<null> = {
      success: true, code: 200, message: 'Chapter deleted successfully', data: null, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'deleteChapter error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to delete chapter', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * PUT /api/courses/:courseId/chapters/reorder
 * Instructor — bulk reorder chapters (drag & drop from Phase 7)
 */
export async function reorderChapters(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  const instructorId = req.headers['x-user-id'] as string;

  try {
    const { error, status } = await verifyCourseOwnership(req.params.courseId, instructorId);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const { chapters } = reorderSchema.parse(req.body);

    // Atomic update all chapter orders
    await prisma.$transaction(
      chapters.map(({ id, order }) =>
        prisma.chapter.update({ where: { id, courseId: req.params.courseId }, data: { order } })
      )
    );

    const response: ApiResponse<null> = {
      success: true, code: 200, message: 'Chapters reordered successfully', data: null, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    logger.error({ err }, 'reorderChapters error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to reorder chapters', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}
