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
});

const updateLessonSchema = z.object({
  title: z.string().min(2).optional(),
  videoUrl: z.string().url('Invalid video URL').optional(),
  duration: z.number().int().min(0).optional(), // seconds
  isPublished: z.boolean().optional(),
  isFree: z.boolean().optional(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

// Kiem tra quyen so huu chapter, admin co the bypass
async function verifyChapterOwnership(courseId: string, chapterId: string, instructorId: string, userRole?: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: 'Course not found', status: 404 };
  if (course.instructorId !== instructorId && userRole !== 'admin') return { error: 'Forbidden — not your course', status: 403 };

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
        order,
        chapterId: req.params.chapterId,
      },
    });

    // Cap nhat tong so bai hoc
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

    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId, chapterId: req.params.chapterId },
      data: validated,
    });

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

    const response: ApiResponse<typeof lesson> = {
      success: true, code: 200, message: 'Lesson updated successfully', data: lesson, trace_id: traceId,
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
