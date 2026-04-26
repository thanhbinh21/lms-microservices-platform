import crypto from 'node:crypto';
import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import { TOPICS } from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import { publishEvent } from '../lib/kafka-producer';

/** GET /api/admin/courses */
export async function listAdminCourses(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {};
    if (status && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      where.status = status;
    }
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          _count: { select: { chapters: true } },
        },
      }),
      prisma.course.count({ where }),
    ]);

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Admin courses fetched',
      data: {
        courses: courses.map((c) => ({
          ...c,
          categoryName: c.category?.name ?? null,
          chapterCount: c._count.chapters,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listAdminCourses');
  }
}

/** PATCH /api/admin/courses/:id/status */
export async function updateCourseStatus(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    if (!status || !['PUBLISHED', 'ARCHIVED'].includes(status)) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Invalid status. Must be PUBLISHED or ARCHIVED',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    const previousStatus = existing.status;
    if (previousStatus === status) {
      const response: ApiResponse<unknown> = {
        success: true,
        code: 200,
        message: `Course already in status ${status}`,
        data: existing,
        trace_id: traceId,
      };
      return res.status(200).json(response);
    }

    const reopenFromArchive = previousStatus === 'ARCHIVED' && status === 'PUBLISHED';

    const course = await prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id },
        data: { status: status as 'PUBLISHED' | 'ARCHIVED' },
      });
      if (reopenFromArchive) {
        await tx.chapter.updateMany({
          where: { courseId: id },
          data: { isPublished: true },
        });
      }
      return updated;
    });

    logger.info(
      { courseId: id, previousStatus, status, reopenFromArchive },
      'Admin updated course status',
    );

    await publishEvent(TOPICS.COURSE_CATALOG_STATUS_CHANGED, {
      courseId: id,
      previousStatus,
      newStatus: status,
      reopenFromArchive,
      traceId,
      occurredAt: new Date().toISOString(),
    });

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: `Course status updated to ${status}`,
      data: course,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'updateCourseStatus');
  }
}

/** GET /api/admin/reviews */
export async function listAdminReviews(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const courseId = req.query.courseId as string | undefined;
    const isFlaggedParam = req.query.isFlagged as string | undefined;

    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;
    if (isFlaggedParam === 'true') where.isFlagged = true;
    else if (isFlaggedParam === 'false') where.isFlagged = false;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { course: { select: { title: true } } },
      }),
      prisma.review.count({ where }),
    ]);

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Admin reviews fetched',
      data: {
        reviews: reviews.map((r) => ({
          ...r,
          courseTitle: r.course.title,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listAdminReviews');
  }
}

/** PATCH /api/admin/reviews/:id/flag */
export async function flagReview(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const { id } = req.params;
    const { isFlagged } = req.body as { isFlagged?: boolean };

    if (typeof isFlagged !== 'boolean') {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'isFlagged must be a boolean',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }

    const review = await prisma.review.update({
      where: { id },
      data: { isFlagged },
      select: { id: true, courseId: true, isFlagged: true },
    });

    const agg = await prisma.review.aggregate({
      where: { courseId: review.courseId, isFlagged: false },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.course.update({
      where: { id: review.courseId },
      data: {
        averageRating: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });

    logger.info({ reviewId: id, isFlagged }, 'Admin toggled review flag');

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: isFlagged ? 'Review flagged' : 'Review unflagged',
      data: review,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'flagReview');
  }
}

/** DELETE /api/admin/reviews/:id */
export async function deleteReview(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Review not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    await prisma.review.delete({ where: { id } });

    const agg = await prisma.review.aggregate({
      where: { courseId: review.courseId, isFlagged: false },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.course.update({
      where: { id: review.courseId },
      data: {
        averageRating: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });

    logger.info({ reviewId: id, courseId: review.courseId }, 'Admin deleted review and recalculated rating');

    const response: ApiResponse<null> = {
      success: true,
      code: 200,
      message: 'Review deleted and course rating recalculated',
      data: null,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteReview');
  }
}

/** GET /api/admin/stats */
export async function getAdminStats(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const [
      totalCourses,
      coursesByStatus,
      totalEnrollments,
      totalReviews,
      flaggedReviews,
    ] = await Promise.all([
      prisma.course.count(),
      prisma.course.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.enrollment.count(),
      prisma.review.count(),
      prisma.review.count({ where: { isFlagged: true } }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const group of coursesByStatus) {
      statusMap[group.status] = group._count.id;
    }

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Admin stats fetched',
      data: {
        totalCourses,
        coursesByStatus: statusMap,
        totalEnrollments,
        totalReviews,
        flaggedReviews,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getAdminStats');
  }
}
