import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { randomUUID } from 'crypto';
import type { ApiResponse } from '@lms/types';

export const enrollCourse = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const courseId = req.params.courseId || req.body.courseId;

  if (!courseId) {
    const response: ApiResponse<null> = {
      success: false, code: 400, message: 'Missing courseId', data: null, trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, price: true, status: true },
    });

    if (!course) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Course not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (course.status !== 'PUBLISHED') {
      const response: ApiResponse<null> = {
        success: false, code: 400, message: 'Course is not published', data: null, trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (existing) {
      const response: ApiResponse<null> = {
        success: true, code: 200, message: 'Already enrolled', data: null, trace_id: traceId,
      };
      return res.status(200).json(response);
    }

    if (course.price && course.price.toNumber() > 0) {
      // Khoa hoc tra phi: FE phai di qua flow payment-service (POST /payment/api/orders).
      // Enrollment se duoc tao async boi Kafka consumer sau khi payment.order.completed.
      const response: ApiResponse<null> = {
        success: false,
        code: 402,
        message: 'Khoa hoc co phi — vui long tao don hang qua /payment/api/orders',
        data: null,
        trace_id: traceId,
      };
      return res.status(402).json(response);
    }

    await prisma.$transaction([
      prisma.enrollment.create({
        data: {
          userId,
          courseId,
          orderId: `FREE-${randomUUID()}`,
        },
      }),
      prisma.course.update({
        where: { id: courseId },
        data: { enrollmentCount: { increment: 1 } },
      }),
    ]);

    const response: ApiResponse<null> = {
      success: true, code: 201, message: 'Enrolled successfully', data: null, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

export const getMyEnrollments = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            instructorId: true,
            totalLessons: true,
            totalDuration: true,
            level: true,
            price: true,
            status: true
          }
        }
      },
      orderBy: { enrolledAt: 'desc' }
    });

    const courseIds = enrollments.map(e => e.courseId);
    
    // Get all lesson progress for these courses
    const userProgress = await prisma.lessonProgress.findMany({
      where: {
        userId: userId,
        lesson: {
          chapter: {
            courseId: { in: courseIds }
          }
        }
      },
      include: {
        lesson: {
          include: {
            chapter: true
          }
        }
      }
    });

    // Map completed lessons count per course
    const completedMap: Record<string, number> = {};
    const lastWatchedMap: Record<string, Date> = {};

    userProgress.forEach(up => {
      const courseId = up.lesson.chapter.courseId;
      if (up.isCompleted) {
        completedMap[courseId] = (completedMap[courseId] || 0) + 1;
      }
      
      const currentLatest = lastWatchedMap[courseId];
      if (!currentLatest || up.updatedAt > currentLatest) {
        lastWatchedMap[courseId] = up.updatedAt;
      }
    });

    const formattedData = enrollments.map(e => {
      const compCount = completedMap[e.courseId] || 0;
      const tLessons = e.course.totalLessons || 0;
      const progressPercent = tLessons > 0 ? Math.round((compCount / tLessons) * 100) : 0;
      
      return {
        ...e,
        progress: Math.min(progressPercent, 100),
        lastAccessedAt: lastWatchedMap[e.courseId] || e.enrolledAt
      };
    });

    const response: ApiResponse<typeof formattedData> = {
      success: true, code: 200, message: 'My enrollments retrieved', data: formattedData, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Server Error', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
};
