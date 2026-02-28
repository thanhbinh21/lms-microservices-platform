import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createCourseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative').default(0),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
});

const updateCourseSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  thumbnail: z.string().url().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInstructorId(req: Request): string {
  // Kong Gateway injects x-user-id — trust this header, never re-verify JWT
  const userId = req.headers['x-user-id'] as string;
  if (!userId) throw new Error('Missing x-user-id header from Gateway');
  return userId;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/courses
 * Public — list all published courses with pagination
 */
export async function listCourses(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [courses, total] = await prisma.$transaction([
      prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnail: true,
          price: true,
          level: true,
          instructorId: true,
          totalLessons: true,
          totalDuration: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.course.count({ where: { status: 'PUBLISHED' } }),
    ]);

    const response: ApiResponse<{ courses: typeof courses; total: number; page: number; limit: number }> = {
      success: true,
      code: 200,
      message: 'Courses fetched successfully',
      data: { courses, total, page, limit },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'listCourses error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to fetch courses', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * GET /api/courses/:slug
 * Public — get course detail with full curriculum
 */
export async function getCourseBySlug(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  try {
    const course = await prisma.course.findUnique({
      where: { slug: req.params.slug, status: 'PUBLISHED' },
      include: {
        chapters: {
          where: { isPublished: true },
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              where: { isPublished: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                order: true,
                duration: true,
                isFree: true,
                // videoUrl excluded — only accessible for enrolled users
              },
            },
          },
        },
      },
    });

    if (!course) {
      const response: ApiResponse<null> = { success: false, code: 404, message: 'Course not found', data: null, trace_id: traceId };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof course> = {
      success: true,
      code: 200,
      message: 'Course fetched successfully',
      data: course,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'getCourseBySlug error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to fetch course', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * GET /api/instructor/courses
 * Instructor — get own courses (including DRAFT)
 */
export async function getInstructorCourses(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  try {
    const instructorId = getInstructorId(req);
    const courses = await prisma.course.findMany({
      where: { instructorId },
      include: { _count: { select: { chapters: true, enrollments: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const response: ApiResponse<typeof courses> = {
      success: true, code: 200, message: 'Instructor courses fetched', data: courses, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'getInstructorCourses error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to fetch courses', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * POST /api/courses
 * Instructor — create a new course
 */
export async function createCourse(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  try {
    const instructorId = getInstructorId(req);
    const validated = createCourseSchema.parse(req.body);

    // Generate unique slug
    let slug = generateSlug(validated.title);
    const existing = await prisma.course.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const course = await prisma.course.create({
      data: {
        title: validated.title,
        slug,
        description: validated.description,
        price: validated.price,
        level: validated.level,
        instructorId,
      },
    });

    const response: ApiResponse<typeof course> = {
      success: true, code: 201, message: 'Course created successfully', data: course, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    logger.error({ err }, 'createCourse error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to create course', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * PUT /api/courses/:id
 * Instructor — update own course
 */
export async function updateCourse(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  try {
    const instructorId = getInstructorId(req);
    const validated = updateCourseSchema.parse(req.body);

    // Ownership check
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) {
      const response: ApiResponse<null> = { success: false, code: 404, message: 'Course not found', data: null, trace_id: traceId };
      return res.status(404).json(response);
    }
    if (course.instructorId !== instructorId) {
      const response: ApiResponse<null> = { success: false, code: 403, message: 'Forbidden — not your course', data: null, trace_id: traceId };
      return res.status(403).json(response);
    }

    // Re-generate slug if title changes
    let slug = course.slug;
    if (validated.title && validated.title !== course.title) {
      slug = generateSlug(validated.title);
      const existing = await prisma.course.findFirst({ where: { slug, NOT: { id: course.id } } });
      if (existing) slug = `${slug}-${Date.now()}`;
    }

    const updated = await prisma.course.update({
      where: { id: req.params.id },
      data: { ...validated, slug },
    });

    const response: ApiResponse<typeof updated> = {
      success: true, code: 200, message: 'Course updated successfully', data: updated, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = { success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId };
      return res.status(400).json(response);
    }
    logger.error({ err }, 'updateCourse error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to update course', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}

/**
 * DELETE /api/courses/:id
 * Instructor — delete own course (only DRAFT allowed)
 */
export async function deleteCourse(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string || '';
  try {
    const instructorId = getInstructorId(req);
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });

    if (!course) {
      const response: ApiResponse<null> = { success: false, code: 404, message: 'Course not found', data: null, trace_id: traceId };
      return res.status(404).json(response);
    }
    if (course.instructorId !== instructorId) {
      const response: ApiResponse<null> = { success: false, code: 403, message: 'Forbidden — not your course', data: null, trace_id: traceId };
      return res.status(403).json(response);
    }
    if (course.status === 'PUBLISHED') {
      const response: ApiResponse<null> = { success: false, code: 400, message: 'Cannot delete a published course. Archive it first.', data: null, trace_id: traceId };
      return res.status(400).json(response);
    }

    await prisma.course.delete({ where: { id: req.params.id } });

    const response: ApiResponse<null> = {
      success: true, code: 200, message: 'Course deleted successfully', data: null, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'deleteCourse error');
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Failed to delete course', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
}
