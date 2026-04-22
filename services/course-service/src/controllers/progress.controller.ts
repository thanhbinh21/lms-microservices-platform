import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import type { ApiResponse } from '@lms/types';

export const getCourseProgress = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    // Check enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } }
    });

    if (!enrollment) {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Not enrolled in this course', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    // Get all completed lessons via LessonProgress joined with Lesson (filtered by courseId)
    // Wait, LessonProgress relates to Lesson. We can get all LessonProgress for user where Lesson.chapter.courseId = courseId
    const progressList = await prisma.lessonProgress.findMany({
      where: {
        userId,
        // @ts-ignore
        lesson: {
          chapter: {
            courseId
          }
        }
      },
    });

    const response: ApiResponse<typeof progressList> = {
      success: true, code: 200, message: 'Progress retrieved', data: progressList, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Server Error', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
};

export const updateLessonProgress = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { lessonId } = req.params;
  const { isCompleted, lastWatched } = req.body;

  try {
    // Upsert progress
    // @ts-ignore
    const progress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      update: {
        ...(isCompleted !== undefined && { isCompleted }),
        ...(lastWatched !== undefined && { lastWatched }),
      },
      create: {
        userId,
        lessonId,
        isCompleted: isCompleted || false,
        lastWatched: lastWatched || 0,
      },
    });

    const response: ApiResponse<typeof progress> = {
      success: true, code: 200, message: 'Progress updated', data: progress, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Server Error', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
};
