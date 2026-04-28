import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/index.js';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import { withRetry } from '@lms/db-prisma';
import { cacheGet } from '@lms/cache';

// Schema tao khoa hoc
const createCourseSchema = z.object({
  title: z.string().min(3, 'Tieu de toi thieu 3 ky tu'),
  description: z.string().optional(),
  price: z.number().min(0, 'Gia phai >= 0').default(0),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
  categoryId: z.string().uuid('Category khong hop le').optional(),
});

// Schema cap nhat khoa hoc
const updateCourseSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  thumbnail: z.string().url().optional(),
  categoryId: z.string().uuid('Category khong hop le').nullable().optional(),
});

const publishCourseSchema = z.object({
  thumbnail: z.string().url().optional(),
});

const certificateTemplateSchema = z.object({
  name: z.string().trim().min(2, 'Ten chung chi toi thieu 2 ky tu').max(120),
  description: z.string().trim().max(500).optional(),
  previewUrl: z.string().url('Preview URL khong hop le').optional(),
});

const updateCourseTemplatesSchema = z.object({
  templateIds: z.array(z.string().uuid('TemplateId khong hop le')).default([]),
});

const reviewBodySchema = z.object({
  rating: z.number().int().min(1, 'Rating toi thieu 1 sao').max(5, 'Rating toi da 5 sao'),
  comment: z.string().trim().max(1000, 'Comment toi da 1000 ky tu').optional(),
});

// Tao hash ngan tu query params de lam cache key cho list endpoint
function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params).sort().reduce((acc: Record<string, unknown>, k) => {
    if (params[k] !== undefined && params[k] !== '') acc[k] = params[k];
    return acc;
  }, {});
  const hash = crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex').slice(0, 12);
  return `${prefix}:${hash}`;
}

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

interface PublishGuardState {
  hasThumbnail: boolean;
  hasAtLeastOneLesson: boolean;
  priceValidForPaidCourse: boolean;
  lessonCount: number;
  paidLessonCount: number;
}

interface RatingStatItem {
  rating: number;
  count: number;
}

type PrismaTransactionClient = Prisma.TransactionClient;

async function computePublishGuard(courseId: string, thumbnail: string, price: number): Promise<PublishGuardState> {
  const [lessonCount, paidLessonCount] = await prisma.$transaction([
    prisma.lesson.count({ where: { chapter: { courseId } } }),
    prisma.lesson.count({ where: { chapter: { courseId }, isFree: false } }),
  ]);

  const hasThumbnail = Boolean(thumbnail.trim());
  const hasAtLeastOneLesson = lessonCount > 0;
  const priceValidForPaidCourse = paidLessonCount === 0 || price > 0;

  return {
    hasThumbnail,
    hasAtLeastOneLesson,
    priceValidForPaidCourse,
    lessonCount,
    paidLessonCount,
  };
}

async function validateCourseBeforePublish(courseId: string, thumbnail: string, price: number, traceId: string): Promise<ApiResponse<null> | null> {
  const guard = await computePublishGuard(courseId, thumbnail, price);

  if (!guard.hasThumbnail) {
    return {
      success: false,
      code: 400,
      message: 'Khong the xuat ban khi chua co thumbnail',
      data: null,
      trace_id: traceId,
    };
  }

  if (!guard.hasAtLeastOneLesson) {
    return {
      success: false,
      code: 400,
      message: 'Khong the xuat ban khi chua co bai hoc',
      data: null,
      trace_id: traceId,
    };
  }

  if (!guard.priceValidForPaidCourse) {
    return {
      success: false,
      code: 400,
      message: 'Khoa hoc co bai hoc tra phi thi gia phai lon hon 0',
      data: null,
      trace_id: traceId,
    };
  }

  return null;
}

function buildReviewAuthor(userId: string) {
  return `Hoc vien #${userId.slice(0, 8)}`;
}

function normalizeReviewComment(comment?: string) {
  if (!comment) return null;
  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function recalculateCourseRating(courseId: string, tx: PrismaTransactionClient) {
  const aggregate = await tx.review.aggregate({
    where: { courseId, isFlagged: false },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await tx.course.update({
    where: { id: courseId },
    data: {
      averageRating: aggregate._avg.rating ?? 0,
      ratingCount: aggregate._count.rating,
    },
  });

  return {
    averageRating: aggregate._avg.rating ?? 0,
    ratingCount: aggregate._count.rating,
  };
}

async function buildCourseReviewStats(courseId: string): Promise<{
  averageRating: number;
  ratingCount: number;
  distribution: RatingStatItem[];
}> {
  const [course, groupedRaw] = await prisma.$transaction([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { averageRating: true, ratingCount: true },
    }),
    prisma.review.groupBy({
      by: ['rating'] as const,
      where: { courseId, isFlagged: false },
      orderBy: { rating: 'desc' },
      _count: { _all: true },
    }),
  ]);

  const grouped = groupedRaw as Array<{ rating: number; _count: { _all: number } }>;
  const groupedMap = new Map<number, number>();
  for (const item of grouped) {
    groupedMap.set(item.rating, item._count._all);
  }

  const distribution: RatingStatItem[] = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: groupedMap.get(rating) ?? 0,
  }));

  return {
    averageRating: course?.averageRating ?? 0,
    ratingCount: course?.ratingCount ?? 0,
    distribution,
  };
}

async function getUserCourseCompletionState(userId: string, courseId: string) {
  const [totalLessons, completedLessons] = await prisma.$transaction([
    prisma.lesson.count({
      where: {
        isPublished: true,
        chapter: { courseId },
      },
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        isCompleted: true,
        lesson: {
          isPublished: true,
          chapter: { courseId },
        },
      },
    }),
  ]);

  const progressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return {
    totalLessons,
    completedLessons,
    progressPercent,
    completed: totalLessons > 0 && completedLessons >= totalLessons,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

const SORT_MAP: Record<string, Prisma.CourseOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  popular: { enrollmentCount: 'desc' },
  rating: { averageRating: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
};

/** GET /api/courses - Discovery endpoint with search, filter & sort */
export async function listCourses(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const q = (req.query.q as string)?.trim() || '';
    const categorySlug = (req.query.category as string)?.trim() || '';
    const sortBy = (req.query.sortBy as string) || 'newest';
    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;
    const minRating = req.query.minRating !== undefined ? Number(req.query.minRating) : undefined;
    const level = (req.query.level as string)?.toUpperCase() || '';

    const where: Prisma.CourseWhereInput = { status: 'PUBLISHED' };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    if (minPrice !== undefined && !isNaN(minPrice)) {
      where.price = { ...(where.price as object), gte: minPrice };
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      where.price = { ...(where.price as object), lte: maxPrice };
    }
    if (minRating !== undefined && !isNaN(minRating)) {
      where.averageRating = { gte: minRating };
    }
    if (level && ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(level)) {
      where.level = level as any;
    }

    const orderBy = SORT_MAP[sortBy] || SORT_MAP.newest;

    // Static data: categories + priceRange it thay doi -> cache 10 phut, lay song song
    const [categories, priceAgg] = await Promise.all([
      cacheGet(
        'cache:categories:all',
        () => prisma.category.findMany({
          include: { _count: { select: { courses: { where: { status: 'PUBLISHED' } } } } },
          orderBy: { order: 'asc' },
        }),
        600,
      ),
      cacheGet(
        'cache:courses:price-range',
        () => prisma.course.aggregate({
          where: { status: 'PUBLISHED' },
          _min: { price: true },
          _max: { price: true },
        }),
        600,
      ),
    ]);

    // Dynamic data: cache 3 phut theo query hash
    const listCacheKey = buildCacheKey('cache:courses:list', {
      q, categorySlug, sortBy, minPrice, maxPrice, minRating, level, page, limit,
    });

    const { courses, total } = await cacheGet(
      listCacheKey,
      async () => {
        const [c, t] = await withRetry(() =>
          prisma.$transaction([
            prisma.course.findMany({
              where,
              select: {
                id: true, title: true, slug: true, description: true,
                thumbnail: true, price: true, level: true, instructorId: true,
                totalLessons: true, totalDuration: true, createdAt: true,
                averageRating: true, ratingCount: true, enrollmentCount: true,
                category: { select: { name: true, slug: true } },
              },
              orderBy,
              skip,
              take: limit,
            }),
            prisma.course.count({ where }),
          ])
        );
        return { courses: c, total: t };
      },
      180,
    );

    const response: ApiResponse<unknown> = {
      success: true, code: 200, message: 'Courses fetched successfully',
      data: {
        courses: courses.map(serializeCourse),
        total,
        page,
        limit,
        filters: {
          categories: categories.map((c) => ({
            slug: c.slug,
            name: c.name,
            courseCount: c._count.courses,
          })),
          priceRange: {
            min: Number(priceAgg._min.price ?? 0),
            max: Number(priceAgg._max.price ?? 0),
          },
          levels: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
        },
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listCourses');
  }
}

/** GET /api/courses/:courseId/reviews - Lay danh sach review cong khai */
export async function listCourseReviews(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const courseId = req.params.courseId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || 'newest';

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });

    if (!course || course.status !== 'PUBLISHED') {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    const orderBy: Prisma.ReviewOrderByWithRelationInput =
      sortBy === 'highest'
        ? { rating: 'desc' }
        : sortBy === 'lowest'
          ? { rating: 'asc' }
          : { createdAt: 'desc' };

    const [reviews, total, stats] = await Promise.all([
      prisma.review.findMany({
        where: { courseId, isFlagged: false },
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          rating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.review.count({ where: { courseId, isFlagged: false } }),
      buildCourseReviewStats(courseId),
    ]);

    const response: ApiResponse<{
      reviews: Array<{
        id: string;
        rating: number;
        comment: string | null;
        createdAt: Date;
        updatedAt: Date;
        author: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      stats: {
        averageRating: number;
        ratingCount: number;
        distribution: RatingStatItem[];
      };
    }> = {
      success: true,
      code: 200,
      message: 'Course reviews fetched',
      data: {
        reviews: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
          author: buildReviewAuthor(review.userId),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listCourseReviews');
  }
}

/** GET /api/courses/:courseId/reviews/stats - Lay thong ke review */
export async function getCourseReviewStats(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const courseId = req.params.courseId;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });

    if (!course || course.status !== 'PUBLISHED') {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    const stats = await buildCourseReviewStats(courseId);

    const response: ApiResponse<typeof stats> = {
      success: true,
      code: 200,
      message: 'Course review stats fetched',
      data: stats,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getCourseReviewStats');
  }
}

/** GET /api/courses/:courseId/reviews/me - Lay review cua user hien tai */
export async function getMyCourseReview(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const courseId = req.params.courseId;
    const userId = res.locals.userId as string;

    const review = await prisma.review.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const response: ApiResponse<typeof review> = {
      success: true,
      code: 200,
      message: 'My course review fetched',
      data: review,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getMyCourseReview');
  }
}

/** POST /api/courses/:courseId/reviews - Tao review 1 lan (yeu cau hoc xong khoa) */
export async function upsertCourseReview(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const courseId = req.params.courseId;
    const userId = res.locals.userId as string;
    const payload = reviewBodySchema.parse(req.body ?? {});

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });

    if (!course || course.status !== 'PUBLISHED') {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });

    if (!enrollment) {
      const forbidden: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Ban can ghi danh khoa hoc truoc khi danh gia',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    const existedReview = await prisma.review.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });

    if (existedReview) {
      const conflict: ApiResponse<null> = {
        success: false,
        code: 409,
        message: 'Ban da gui danh gia cho khoa hoc nay',
        data: null,
        trace_id: traceId,
      };
      return res.status(409).json(conflict);
    }

    const completionState = await getUserCourseCompletionState(userId, courseId);
    if (!completionState.completed) {
      const forbidden: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Chi co the danh gia sau khi hoan thanh 100% khoa hoc',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    const comment = normalizeReviewComment(payload.comment);

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          userId,
          courseId,
          rating: payload.rating,
          comment,
        },
      });

      const stats = await recalculateCourseRating(courseId, tx);
      return { review, stats };
    });

    const response: ApiResponse<{
      review: {
        id: string;
        rating: number;
        comment: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      stats: {
        averageRating: number;
        ratingCount: number;
      };
    }> = {
      success: true,
      code: 200,
      message: 'Course review saved',
      data: {
        review: {
          id: result.review.id,
          rating: result.review.rating,
          comment: result.review.comment,
          createdAt: result.review.createdAt,
          updatedAt: result.review.updatedAt,
        },
        stats: result.stats,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0]?.message || 'Invalid review payload',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'upsertCourseReview');
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
        category: { select: { name: true, slug: true } },
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

    // Chi tra ve URL bai hoc trong /playback API khi da enroll. Tra ve null de an video tren trang course detail (review mode).
    const sanitizedCourse = {
      ...serializeCourse(course),
      chapters: course.chapters.map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.map((lesson) => ({
          ...lesson,
          videoUrl: null, // LUON an video
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
    // Chi select truong can thiet cho instructor dashboard (C3)
    const courses = await withRetry(() => prisma.course.findMany({
      where: { instructorId },
      select: {
        id: true, title: true, slug: true, status: true, price: true,
        thumbnail: true, enrollmentCount: true, level: true,
        updatedAt: true, createdAt: true,
        _count: { select: { chapters: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }));

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
      include: {
        _count: { select: { chapters: true, enrollments: true } },
        communityGroups: {
          select: { id: true, name: true, slug: true, courseId: true },
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
      success: true, code: 200, message: 'Course fetched',
      data: serializeCourse(course), trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getInstructorCourseById');
  }
}

/**
 * GET /api/instructor/certificate-templates
 */
export async function listInstructorCertificateTemplates(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;

  try {
    const templates = await prisma.certificateTemplate.findMany({
      where: { instructorId },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Certificate templates fetched',
      data: templates,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listInstructorCertificateTemplates');
  }
}

/**
 * POST /api/instructor/certificate-templates
 */
export async function createInstructorCertificateTemplate(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;

  try {
    const payload = certificateTemplateSchema.parse(req.body);
    const created = await prisma.certificateTemplate.create({
      data: {
        instructorId,
        name: payload.name,
        description: payload.description,
        previewUrl: payload.previewUrl,
      },
    });

    const response: ApiResponse<unknown> = {
      success: true,
      code: 201,
      message: 'Certificate template created',
      data: created,
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0]?.message || 'Du lieu khong hop le',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'createInstructorCertificateTemplate');
  }
}

/**
 * PUT /api/instructor/certificate-templates/:id
 */
export async function updateInstructorCertificateTemplate(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = (res.locals.userRole as string) || '';
  const templateId = req.params.id;

  try {
    const payload = certificateTemplateSchema.partial().parse(req.body);
    const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Khong tim thay template',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    if (template.instructorId !== instructorId && userRole.toLowerCase() !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Khong co quyen cap nhat template',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    const updated = await prisma.certificateTemplate.update({
      where: { id: template.id },
      data: {
        name: payload.name ?? template.name,
        description: payload.description ?? template.description,
        previewUrl: payload.previewUrl ?? template.previewUrl,
      },
    });

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Certificate template updated',
      data: updated,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0]?.message || 'Du lieu khong hop le',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'updateInstructorCertificateTemplate');
  }
}

/**
 * DELETE /api/instructor/certificate-templates/:id
 */
export async function deleteInstructorCertificateTemplate(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = (res.locals.userRole as string) || '';
  const templateId = req.params.id;

  try {
    const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Khong tim thay template',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    if (template.instructorId !== instructorId && userRole.toLowerCase() !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Khong co quyen xoa template',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    const usageCount = await prisma.courseCertificateTemplate.count({ where: { templateId } });
    if (usageCount > 0) {
      const conflict: ApiResponse<null> = {
        success: false,
        code: 409,
        message: 'Template dang duoc gan vao khoa hoc',
        data: null,
        trace_id: traceId,
      };
      return res.status(409).json(conflict);
    }

    await prisma.certificateTemplate.delete({ where: { id: template.id } });
    const response: ApiResponse<null> = {
      success: true,
      code: 200,
      message: 'Template da duoc xoa',
      data: null,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteInstructorCertificateTemplate');
  }
}

/**
 * GET /api/instructor/courses/:id/certificate-templates
 */
export async function getCourseCertificateTemplates(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = (res.locals.userRole as string) || '';
  const courseId = req.params.id;

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
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

    if (course.instructorId !== instructorId && userRole.toLowerCase() !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Khong co quyen',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    const links = await prisma.courseCertificateTemplate.findMany({
      where: { courseId },
      select: { templateId: true },
    });

    const response: ApiResponse<string[]> = {
      success: true,
      code: 200,
      message: 'Course certificate templates fetched',
      data: links.map((item) => item.templateId),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getCourseCertificateTemplates');
  }
}

/**
 * PUT /api/instructor/courses/:id/certificate-templates
 */
export async function updateCourseCertificateTemplates(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = (res.locals.userRole as string) || '';
  const courseId = req.params.id;

  try {
    const payload = updateCourseTemplatesSchema.parse(req.body);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
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

    if (course.instructorId !== instructorId && userRole.toLowerCase() !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Khong co quyen',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    if (payload.templateIds.length > 0) {
      const ownedTemplates = await prisma.certificateTemplate.findMany({
        where: {
          id: { in: payload.templateIds },
          ...(userRole.toLowerCase() === 'admin' ? {} : { instructorId }),
        },
        select: { id: true },
      });

      if (ownedTemplates.length !== payload.templateIds.length) {
        const bad: ApiResponse<null> = {
          success: false,
          code: 400,
          message: 'Template khong hop le hoac khong thuoc so huu',
          data: null,
          trace_id: traceId,
        };
        return res.status(400).json(bad);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.courseCertificateTemplate.deleteMany({ where: { courseId } });

      if (payload.templateIds.length > 0) {
        await tx.courseCertificateTemplate.createMany({
          data: payload.templateIds.map((templateId) => ({
            courseId,
            templateId,
          })),
        });
      }
    });

    const response: ApiResponse<string[]> = {
      success: true,
      code: 200,
      message: 'Course certificate templates updated',
      data: payload.templateIds,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0]?.message || 'Du lieu khong hop le',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'updateCourseCertificateTemplates');
  }
}

/** GET /api/instructor/courses/:id/publish-guard - Trang thai guard de frontend khoa nut publish */
export async function getCoursePublishGuard(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;
  const courseId = req.params.id;

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
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

    const guard = await computePublishGuard(course.id, course.thumbnail ?? '', Number(course.price));

    const response: ApiResponse<PublishGuardState> = {
      success: true,
      code: 200,
      message: 'Publish guard fetched',
      data: guard,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getCoursePublishGuard');
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
        categoryId: validated.categoryId,
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
      const nextPrice = Number(validated.price ?? course.price);
      const publishValidationError = await validateCourseBeforePublish(req.params.id, thumbnail, nextPrice, traceId);
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
    const nextPrice = Number(course.price);
    const publishValidationError = await validateCourseBeforePublish(course.id, nextThumbnail, nextPrice, traceId);
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
      // Khi publish khoa hoc, tu dong publish cac bai da co video de hoc vien thay duoc noi dung hop le.
      await tx.lesson.updateMany({
        where: {
          chapter: { courseId: course.id },
          videoUrl: { not: null },
        },
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
