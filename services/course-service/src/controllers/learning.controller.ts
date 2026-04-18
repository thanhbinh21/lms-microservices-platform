import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import type { ApiResponse } from '@lms/types';
import { randomUUID } from 'crypto';

export const enrollFree = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, price: true, status: true },
    });

    if (!course) {
      const response: ApiResponse<null> = { success: false, code: 404, message: 'Course not found', data: null, trace_id: traceId };
      return res.status(404).json(response);
    }
    if (course.status !== 'PUBLISHED') {
      const response: ApiResponse<null> = { success: false, code: 400, message: 'Course not published', data: null, trace_id: traceId };
      return res.status(400).json(response);
    }

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (existing) {
      const response: ApiResponse<null> = { success: true, code: 200, message: 'Already enrolled', data: null, trace_id: traceId };
      return res.status(200).json(response);
    }

    if (course.price && course.price.toNumber() > 0) {
      const response: ApiResponse<null> = { success: false, code: 402, message: 'Paid course', data: null, trace_id: traceId };
      return res.status(402).json(response);
    }

    await prisma.$transaction([
      prisma.enrollment.create({
        data: { userId, courseId, orderId: `FREE-${randomUUID()}` },
      }),
      prisma.course.update({
        where: { id: courseId },
        data: { enrollmentCount: { increment: 1 } },
      }),
    ]);

    const response: ApiResponse<null> = { success: true, code: 201, message: 'Enrolled', data: null, trace_id: traceId };
    return res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse<null> = { success: false, code: 500, message: 'Error', data: null, trace_id: traceId };
    return res.status(500).json(response);
  }
};

export const getLearnData = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } }
    });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ success: false, code: 404, message: 'Not found' });
    }

    const userProgress = await prisma.lessonProgress.findMany({
      where: { userId, lesson: { chapter: { courseId } } }
    });
    
    // mapping progress list to map
    const progressMap = new Map(userProgress.map(p => [p.lessonId, p]));
    let completedLessons = 0;
    
    const chaptersMapped = course.chapters.map(c => ({
      id: c.id,
      title: c.title,
      order: c.order,
      lessons: c.lessons.map(l => {
        const p = progressMap.get(l.id);
        if (p?.isCompleted) completedLessons++;
        return {
          id: l.id,
          title: l.title,
          order: l.order,
          videoUrl: l.videoUrl,
          sourceType: l.sourceType,
          duration: l.duration,
          isFree: l.isFree,
          progress: p ? {
            ...p,
            watchedDuration: p.lastWatched,
            lastPosition: p.lastWatched,
            courseId
          } : null
        };
      })
    }));

    const totalLessons = course.totalLessons || 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    const data = {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        thumbnail: course.thumbnail,
        totalLessons: course.totalLessons,
        totalDuration: course.totalDuration,
      },
      enrolled: !!enrollment,
      chapters: chaptersMapped,
      progressPercent,
      completedLessons,
      totalLessons,
    };

    return res.status(200).json({ success: true, code: 200, message: 'Success', data, trace_id: traceId });
  } catch (err: any) {
    return res.status(500).json({ success: false, code: 500, message: 'Server Error' });
  }
};

export const getEnrollmentStatus = async (req: Request, res: Response): Promise<Response | void> => {
  const userId = res.locals.userId as string;
  const { courseId } = req.params;
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } }
    });
    return res.status(200).json({
      success: true, code: 200, message: 'Success',
      data: { enrolled: !!enrollment, enrollment }
    });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500 });
  }
};

export const completeLesson = async (req: Request, res: Response): Promise<Response | void> => {
  const userId = res.locals.userId as string;
  const { lessonId } = req.params;
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: true }
    });
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
    
    const courseId = lesson.chapter.courseId;
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } }
    });
    if (!enrollment) return res.status(403).json({ success: false, message: 'Not enrolled' });

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, isCompleted: true, lastWatched: 0 },
      update: { isCompleted: true }
    });
    
    return res.status(200).json({ success: true, code: 200, data: { ...progress, courseCompleted: false } });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500 });
  }
};

export const getMyCourses = async (_req: Request, res: Response): Promise<Response | void> => {
  const userId = res.locals.userId as string;
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true, title: true, slug: true, thumbnail: true,
            totalLessons: true, totalDuration: true, level: true, instructorId: true,
          }
        }
      },
      orderBy: { enrolledAt: 'desc' }
    });

    const data = enrollments.map(e => ({
      ...e.course,
      enrolledAt: e.enrolledAt,
      enrollmentType: 'FREE',
      progressPercent: 0,
      completedLessons: 0,
      totalWatchedSeconds: 0,
      lastLessonId: null,
      lastAccessedAt: e.enrolledAt
    }));

    return res.status(200).json({ success: true, code: 200, data });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500 });
  }
};
