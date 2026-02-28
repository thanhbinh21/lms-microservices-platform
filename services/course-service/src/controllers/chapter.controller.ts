import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';

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

// Kiem tra quyen so huu khoa hoc, admin co the bypass
async function verifyCourseOwnership(courseId: string, instructorId: string, userRole?: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: 'Course not found', status: 404 };
  if (course.instructorId !== instructorId && userRole !== 'admin') return { error: 'Forbidden — not your course', status: 403 };
  return { course };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/** POST /api/courses/:courseId/chapters - Them chuong vao khoa hoc */
export async function createChapter(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const { error, status } = await verifyCourseOwnership(req.params.courseId, instructorId, userRole);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const validated = createChapterSchema.parse(req.body);

    // Tu dong gan thu tu (them vao cuoi)
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
    return handlePrismaError(err, res, traceId, 'createChapter');
  }
}

/** PUT /api/courses/:courseId/chapters/:chapterId - Cap nhat chuong */
export async function updateChapter(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const { error, status } = await verifyCourseOwnership(req.params.courseId, instructorId, userRole);
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
    return handlePrismaError(err, res, traceId, 'updateChapter');
  }
}

/** DELETE /api/courses/:courseId/chapters/:chapterId - Xoa chuong */
export async function deleteChapter(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const { error, status } = await verifyCourseOwnership(req.params.courseId, instructorId, userRole);
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
    return handlePrismaError(err, res, traceId, 'deleteChapter');
  }
}

/** PUT /api/courses/:courseId/chapters/reorder - Sap xep lai chuong */
export async function reorderChapters(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const { error, status } = await verifyCourseOwnership(req.params.courseId, instructorId, userRole);
    if (error) {
      const response: ApiResponse<null> = { success: false, code: status!, message: error, data: null, trace_id: traceId };
      return res.status(status!).json(response);
    }

    const { chapters } = reorderSchema.parse(req.body);

    // Cap nhat thu tu dong loat trong transaction
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
    return handlePrismaError(err, res, traceId, 'reorderChapters');
  }
}
