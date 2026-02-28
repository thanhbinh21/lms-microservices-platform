import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';

// Schema tao khoa hoc
const createCourseSchema = z.object({
  title: z.string().min(3, 'Tieu de toi thieu 3 ky tu'),
  description: z.string().optional(),
  price: z.number().min(0, 'Gia phai >= 0').default(0),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
});

// Schema cap nhat khoa hoc
const updateCourseSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  thumbnail: z.string().url().optional(),
});

// Tao slug tu tieu de
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Tao slug duy nhat - them -1, -2, -3 neu bi trung */
async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = generateSlug(title);
  let slug = base;
  let counter = 1;
  for (;;) {
    const existing = await prisma.course.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${counter++}`;
  }
}

/**
 * Chuyen Decimal (truong price) thanh number de JSON serialize.
 */
function serializeCourse<T extends { price: unknown }>(course: T): Omit<T, 'price'> & { price: number } {
  return { ...course, price: Number(course.price) };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/** GET /api/courses - Danh sach khoa hoc da xuat ban (co phan trang) */
export async function listCourses(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [courses, total] = await prisma.$transaction([
      prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true, title: true, slug: true, description: true,
          thumbnail: true, price: true, level: true, instructorId: true,
          totalLessons: true, totalDuration: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.course.count({ where: { status: 'PUBLISHED' } }),
    ]);

    const response: ApiResponse<unknown> = {
      success: true, code: 200, message: 'Courses fetched successfully',
      data: { courses: courses.map(serializeCourse), total, page, limit },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listCourses');
  }
}

/** GET /api/courses/:slug - Chi tiet khoa hoc voi chuong trinh giang day */
export async function getCourseBySlug(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
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
              },
            },
          },
        },
      },
    });

    if (!course) {
      const notFound: ApiResponse<null> = {
        success: false, code: 404, message: 'Course not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    const response: ApiResponse<unknown> = {
      success: true, code: 200, message: 'Course fetched successfully',
      data: serializeCourse(course), trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getCourseBySlug');
  }
}

/** GET /api/instructor/courses - Lay danh sach khoa hoc cua giang vien */
export async function getInstructorCourses(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  try {
    const courses = await prisma.course.findMany({
      where: { instructorId },
      include: { _count: { select: { chapters: true, enrollments: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const response: ApiResponse<unknown> = {
      success: true, code: 200, message: 'Instructor courses fetched',
      data: courses.map(serializeCourse), trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getInstructorCourses');
  }
}

/** POST /api/courses - Tao khoa hoc moi */
export async function createCourse(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  try {
    const validated = createCourseSchema.parse(req.body);
    const slug = await generateUniqueSlug(validated.title);

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

    const response: ApiResponse<unknown> = {
      success: true, code: 201, message: 'Course created successfully',
      data: serializeCourse(course), trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'createCourse');
  }
}

/** PUT /api/courses/:id - Cap nhat khoa hoc (admin duoc phep cap nhat moi khoa hoc) */
export async function updateCourse(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;
  try {
    const validated = updateCourseSchema.parse(req.body);

    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) {
      const notFound: ApiResponse<null> = {
        success: false, code: 404, message: 'Khong tim thay khoa hoc', data: null, trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }
    // Admin duoc phep cap nhat bat ky khoa hoc nao
    if (course.instructorId !== instructorId && userRole !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false, code: 403, message: 'Khong co quyen - khong phai khoa hoc cua ban', data: null, trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    let slug = course.slug;
    if (validated.title && validated.title !== course.title) {
      slug = await generateUniqueSlug(validated.title, course.id);
    }

    const updated = await prisma.course.update({
      where: { id: req.params.id },
      data: { ...validated, slug },
    });

    const response: ApiResponse<unknown> = {
      success: true, code: 200, message: 'Course updated successfully',
      data: serializeCourse(updated), trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false, code: 400, message: err.errors[0].message, data: null, trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'updateCourse');
  }
}

/** DELETE /api/courses/:id - Xoa khoa hoc (chi DRAFT, admin duoc phep) */
export async function deleteCourse(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) {
      const notFound: ApiResponse<null> = {
        success: false, code: 404, message: 'Khong tim thay khoa hoc', data: null, trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }
    if (course.instructorId !== instructorId && userRole !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false, code: 403, message: 'Khong co quyen - khong phai khoa hoc cua ban', data: null, trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }
    if (course.status === 'PUBLISHED') {
      const bad: ApiResponse<null> = {
        success: false, code: 400,
        message: 'Khong the xoa khoa hoc da xuat ban. Hay luu tru truoc.',
        data: null, trace_id: traceId,
      };
      return res.status(400).json(bad);
    }

    await prisma.course.delete({ where: { id: req.params.id } });

    const response: ApiResponse<null> = {
      success: true, code: 200, message: 'Course deleted successfully', data: null, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteCourse');
  }
}
