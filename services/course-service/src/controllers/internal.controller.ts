import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { logger } from '@lms/logger';

/**
 * Endpoints noi bo — chi cho cac service khac trong cluster goi truc tiep
 * (khong di qua Kong). Phat hien bang header `x-internal-call`.
 *
 * Payment-service dung endpoint nay de verify price (chong client tampering).
 */

/**
 * GET /internal/courses/:id — tra ve thong tin toi thieu de tinh gia.
 */
export const getCourseByIdInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        status: true,
        instructorId: true,
        totalLessons: true,
        totalDuration: true,
        level: true,
        thumbnail: true,
      },
    });

    if (!course) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const serializedCourse = { ...course, price: course.price.toNumber() };

    const response: ApiResponse<typeof serializedCourse> = {
      success: true,
      code: 200,
      message: 'OK',
      data: serializedCourse,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getCourseByIdInternal error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal Server Error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/courses/:id/curriculum
 * Tra ve danh sach chapter + lessons cua 1 course.
 * Learning-service dung de render trang /learn.
 */
export const getCourseCurriculumInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const chapters = await prisma.chapter.findMany({
      where: { courseId: id, isPublished: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        order: true,
        lessons: {
          where: { isPublished: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            content: true,
            videoUrl: true,
            sourceType: true,
            duration: true,
            isFree: true,
          },
        },
      },
    });

    const response: ApiResponse<typeof chapters> = {
      success: true,
      code: 200,
      message: 'OK',
      data: chapters,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getCourseCurriculumInternal error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal Server Error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/lessons/:id
 * Tra ve thong tin lesson: courseId, chapterId, isFree, duration.
 * Learning-service dung de verify enrollment truoc khi update progress.
 */
export const getLessonByIdInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        isFree: true,
        duration: true,
        chapter: {
          select: { id: true, courseId: true },
        },
      },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const data = {
      id: lesson.id,
      title: lesson.title,
      isFree: lesson.isFree,
      duration: lesson.duration,
      chapterId: lesson.chapter.id,
      courseId: lesson.chapter.courseId,
    };

    const response: ApiResponse<typeof data> = {
      success: true, code: 200, message: 'OK', data, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getLessonByIdInternal error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/instructors/:instructorId/courses
 * Tra ve danh sach course IDs cua 1 instructor.
 * Community-service dung de loc cau hoi theo khoa hoc cua giang vien.
 */
export const getInstructorCourseIdsInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { instructorId } = req.params;

  try {
    const courses = await prisma.course.findMany({
      where: { instructorId },
      select: { id: true, title: true, slug: true },
    });

    const data = {
      courseIds: courses.map((c) => c.id),
      courses: courses,
    };

    const response: ApiResponse<typeof data> = {
      success: true, code: 200, message: 'OK', data, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, instructorId }, 'getInstructorCourseIdsInternal error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};
