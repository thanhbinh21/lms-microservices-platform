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

const publishCourseSchema = z.object({
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
  const existingSlugs = await prisma.course.findMany({
    where: {
      slug: {
        startsWith: base,
      },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });

  const slugSet = new Set(existingSlugs.map((item) => item.slug));
  if (!slugSet.has(base)) {
    return base;
  }

  let counter = 1;
  while (slugSet.has(`${base}-${counter}`)) {
    counter += 1;
  }

  return `${base}-${counter}`;
}

/**
 * Chuyen Decimal (truong price) thanh number de JSON serialize.
 */
function serializeCourse<T extends { price: unknown }>(course: T): Omit<T, 'price'> & { price: number } {
  return { ...course, price: Number(course.price) };
}

function inferSourceType(videoUrl?: string | null): 'UPLOAD' | 'YOUTUBE' {
  if (!videoUrl) return 'UPLOAD';
  return videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? 'YOUTUBE' : 'UPLOAD';
}

async function validateCourseBeforePublish(courseId: string, thumbnail: string, traceId: string): Promise<ApiResponse<null> | null> {
  if (!thumbnail.trim()) {
    return {
      success: false,
      code: 400,
      message: 'Khong the xuat ban khi chua co thumbnail',
      data: null,
      trace_id: traceId,
    };
  }

  // Kiem tra du lieu toi thieu de tranh hien thi khoa hoc rong tren trang hoc vien.
  const [chapterCount, lessonCount, publishableLessonCount] = await prisma.$transaction([
    prisma.chapter.count({ where: { courseId } }),
    prisma.lesson.count({ where: { chapter: { courseId } } }),
    prisma.lesson.count({
      where: {
        chapter: { courseId },
        isPublished: true,
        videoUrl: { not: null },
      },
    }),
  ]);

  if (chapterCount === 0) {
    return {
      success: false,
      code: 400,
      message: 'Khong the xuat ban khi chua co chuong hoc',
      data: null,
      trace_id: traceId,
    };
  }

  if (lessonCount === 0) {
    return {
      success: false,
      code: 400,
      message: 'Khong the xuat ban khi chua co bai hoc',
      data: null,
      trace_id: traceId,
    };
  }

  if (publishableLessonCount === 0) {
    return {
      success: false,
      code: 400,
      message: 'Can it nhat 1 bai hoc da publish va co video de xuat ban khoa hoc',
      data: null,
      trace_id: traceId,
    };
  }

  return null;
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
    // Chi lay chuong co it nhat 1 bai da publish (khong yeu cau chapter.isPublished —
    // nhieu khoa chi bat publish bai ma quen publish chuong)
    const course = await prisma.course.findFirst({
      where: { slug: req.params.slug, status: 'PUBLISHED' },
      include: {
        chapters: {
          where: { lessons: { some: { isPublished: true } } },
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
                videoUrl: true,
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

    // Chi tra ve videoUrl cho bai hoc free de dam bao luong xem thu khong lam ro noi dung tra phi
    const sanitizedCourse = {
      ...serializeCourse(course),
      chapters: course.chapters.map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.map((lesson) => ({
          ...lesson,
          videoUrl: lesson.isFree ? lesson.videoUrl : null,
          sourceType: inferSourceType(lesson.videoUrl),
        })),
      })),
    };

    const response: ApiResponse<unknown> = {
      success: true, code: 200, message: 'Course fetched successfully',
      data: sanitizedCourse, trace_id: traceId,
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

/** GET /api/instructor/courses/:id - Lay chi tiet 1 khoa hoc cua giang vien */
export async function getInstructorCourseById(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const courseId = req.params.id;
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId, instructorId },
      include: { _count: { select: { chapters: true, enrollments: true } } },
    });

    if (!course) {
      const notFound: ApiResponse<null> = {
        success: false, code: 404, message: 'Course not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    const response: ApiResponse<unknown> = {
      success: true, code: 200, message: 'Course fetched',
      data: serializeCourse(course), trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getInstructorCourseById');
  }
}
/** GET /api/courses/:id/curriculum - Lay curriculum cho giang vien/admin theo courseId */
export async function getCourseCurriculum(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        chapters: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!course) {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    if (course.instructorId !== instructorId && userRole?.toLowerCase() !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Forbidden — not your course',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    const courseWithSourceType = {
      ...serializeCourse(course),
      chapters: course.chapters.map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.map((lesson) => ({
          ...lesson,
          sourceType: inferSourceType(lesson.videoUrl),
        })),
      })),
    };

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Course curriculum fetched',
      data: courseWithSourceType,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getCourseCurriculum');
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
    if (course.instructorId !== instructorId && userRole?.toLowerCase() !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false, code: 403, message: 'Khong co quyen - khong phai khoa hoc cua ban', data: null, trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    let slug = course.slug;
    if (validated.title && validated.title !== course.title) {
      slug = await generateUniqueSlug(validated.title, course.id);
    }

    if (validated.status === 'PUBLISHED') {
      const thumbnail = validated.thumbnail ?? course.thumbnail ?? '';
      const publishValidationError = await validateCourseBeforePublish(req.params.id, thumbnail, traceId);
      if (publishValidationError) {
        return res.status(publishValidationError.code).json(publishValidationError);
      }
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

/** POST /api/courses/:id/publish - Xuat ban khoa hoc (chi owner/admin) */
export async function publishCourse(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const payload = publishCourseSchema.parse(req.body ?? {});
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Khong tim thay khoa hoc',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    if (course.instructorId !== instructorId && userRole?.toLowerCase() !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Khong co quyen - khong phai khoa hoc cua ban',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    if (course.status === 'PUBLISHED') {
      const alreadyPublished: ApiResponse<unknown> = {
        success: true,
        code: 200,
        message: 'Course already published',
        data: serializeCourse(course),
        trace_id: traceId,
      };
      return res.status(200).json(alreadyPublished);
    }

    const nextThumbnail = payload.thumbnail?.trim() || course.thumbnail || '';
    const publishValidationError = await validateCourseBeforePublish(course.id, nextThumbnail, traceId);
    if (publishValidationError) {
      return res.status(publishValidationError.code).json(publishValidationError);
    }

    const publishedCourse = await prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id: course.id },
        data: { status: 'PUBLISHED', thumbnail: nextThumbnail },
      });
      // Dong bo: khi khoa da publish, tat ca chuong hien thi cong khai (tranh catalog trong khi bai da publish)
      await tx.chapter.updateMany({
        where: { courseId: course.id },
        data: { isPublished: true },
      });
      return updated;
    });

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Course published successfully',
      data: serializeCourse(publishedCourse),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0].message,
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'publishCourse');
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
    if (course.instructorId !== instructorId && userRole?.toLowerCase() !== 'admin') {
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
