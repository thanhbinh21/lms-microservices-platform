import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { randomUUID } from 'crypto';
import type { ApiResponse } from '@lms/types';

export const enrollFreeCourse = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.body;

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

    if (course.price && course.price.toNumber() > 0) {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Course is not free, payment required', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
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

    // Create free enrollment
    await prisma.enrollment.create({
      data: {
        userId,
        courseId,
        orderId: `FREE-${randomUUID()}`,
      },
    });

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
