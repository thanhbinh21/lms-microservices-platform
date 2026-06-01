import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma.js';
import { getCourseById } from '../lib/course-client.js';
import { enqueueEnrollmentCreatedOutbox } from '../lib/outbox.js';

/** POST /api/courses/:courseId/enroll — Ghi danh khoa hoc mien phi */
export const enrollCourse = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    // Lay thong tin khoa hoc tu course-service
    const course = await getCourseById(courseId);
    if (!course) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Không tìm thấy khóa học', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (course.status !== 'PUBLISHED') {
      const response: ApiResponse<null> = {
        success: false, code: 400, message: 'Khóa học chưa được phát hành', data: null, trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    // Idempotent: check da enroll chua
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) {
      const response: ApiResponse<null> = {
        success: true, code: 200, message: 'Bạn đã ghi danh khóa học này', data: null, trace_id: traceId,
      };
      return res.status(200).json(response);
    }

    // Chi cho phep enroll mien phi
    if (course.price && course.price > 0) {
      const response: ApiResponse<null> = {
        success: false,
        code: 402,
        message: 'Khóa học có phí — vui lòng tạo đơn hàng qua /payment/api/orders',
        data: null,
        trace_id: traceId,
      };
      return res.status(402).json(response);
    }

    const orderId = `FREE-${randomUUID()}`;
    const outbox = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: { userId, courseId, orderId },
      });

      // Enrollment va event phai atomic de downstream khong bi lech counter/notification.
      return enqueueEnrollmentCreatedOutbox(
        tx,
        {
          user_id: userId,
          course_id: courseId,
          order_id: orderId,
          enrolled_at: enrollment.enrolledAt.toISOString(),
        },
        traceId,
      );
    });
    if (outbox.created) {
      logger.info(
        { event: 'outbox.created', outboxId: outbox.id, topic: 'learning.enrollment.created', orderId },
        'outbox.created',
      );
    }
    const response: ApiResponse<null> = {
      success: true, code: 201, message: 'Ghi danh thành công', data: null, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    logger.error({ err, userId, courseId, traceId }, 'enrollCourse failed');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/** GET /api/my-enrollments — Lay danh sach khoa hoc da ghi danh */
export const getMyEnrollments = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      orderBy: { enrolledAt: 'desc' },
    });

    // Lay progress cho tung khoa hoc
    const courseIds = enrollments.map((e) => e.courseId);
    const progresses = await prisma.lessonProgress.findMany({
      where: { userId, courseId: { in: courseIds } },
      select: {
        courseId: true,
        lessonId: true,
        isCompleted: true,
        lastWatched: true,
        updatedAt: true,
      },
    });

    // Tinh toan completedCount / watchedSeconds / lastAccessed per course
    const completedMap: Record<string, number> = {};
    const watchedSecondsMap: Record<string, number> = {};
    const lastWatchedMap: Record<string, Date> = {};
    const lastLessonMap: Record<string, string> = {};
    for (const p of progresses) {
      if (p.isCompleted) completedMap[p.courseId] = (completedMap[p.courseId] || 0) + 1;
      watchedSecondsMap[p.courseId] = (watchedSecondsMap[p.courseId] || 0) + (p.lastWatched || 0);
      const cur = lastWatchedMap[p.courseId];
      if (!cur || p.updatedAt > cur) {
        lastWatchedMap[p.courseId] = p.updatedAt;
        lastLessonMap[p.courseId] = p.lessonId;
      }
    }

    // Lay thong tin course tu course-service (parallel, best-effort)
    const courseDetails: Record<string, any> = {};
    await Promise.allSettled(
      courseIds.map(async (id) => {
        const c = await getCourseById(id);
        if (c) courseDetails[id] = c;
      }),
    );

    const result = enrollments.map((e) => {
      const course = courseDetails[e.courseId] || {};
      const totalLessons = course.totalLessons || 0;
      const completedCount = completedMap[e.courseId] || 0;
      const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      return {
        id: course.id || e.courseId,
        title: course.title || 'Khóa học',
        slug: course.slug || e.courseId,
        thumbnail: course.thumbnail || null,
        totalLessons,
        totalDuration: course.totalDuration || 0,
        level: course.level || 'BEGINNER',
        instructorId: course.instructorId || '',
        enrolledAt: e.enrolledAt,
        enrollmentType: e.orderId.startsWith('FREE-') ? 'FREE' : 'PAID',
        progressPercent: Math.min(progressPercent, 100),
        completedLessons: completedCount,
        totalWatchedSeconds: watchedSecondsMap[e.courseId] || 0,
        lastLessonId: lastLessonMap[e.courseId] || null,
        lastAccessedAt: lastWatchedMap[e.courseId] || e.enrolledAt,
      };
    });

    const response: ApiResponse<typeof result> = {
      success: true, code: 200, message: 'Danh sách khóa học đã ghi danh', data: result, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'getMyEnrollments failed');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/** GET /api/courses/:courseId/enrollment-status */
export const checkEnrollmentStatus = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    const response: ApiResponse<{ enrolled: boolean; enrolledAt: Date | null }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { enrolled: !!enrollment, enrolledAt: enrollment?.enrolledAt ?? null },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, courseId, traceId }, 'checkEnrollmentStatus failed');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};
