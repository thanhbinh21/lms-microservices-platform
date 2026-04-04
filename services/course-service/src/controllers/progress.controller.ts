import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import { publishEvent } from '../lib/kafka-producer';
import { TOPICS } from '@lms/kafka-client';

const COMPLETION_THRESHOLD = 0.8;

const updateProgressSchema = z.object({
  watchedDuration: z.number().int().min(0),
  lastPosition: z.number().int().min(0),
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function resolveLessonWithCourse(lessonId: string) {
  return prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          course: { select: { id: true, title: true, status: true, price: true, totalLessons: true } },
        },
      },
    },
  });
}

async function checkEnrollment(userId: string, courseId: string) {
  return prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
}

function ok<T>(res: Response, data: T, message: string, traceId: string, code = 200) {
  const response: ApiResponse<T> = { success: true, code, message, data, trace_id: traceId };
  return res.status(code).json(response);
}

function fail(res: Response, code: number, message: string, traceId: string) {
  const response: ApiResponse<null> = { success: false, code, message, data: null, trace_id: traceId };
  return res.status(code).json(response);
}

// ─── POST /api/student/courses/:courseId/enroll-free ─────────────────────────

export async function enrollFree(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return fail(res, 404, 'Course not found', traceId);
    if (course.status !== 'PUBLISHED') return fail(res, 400, 'Course is not published', traceId);
    if (Number(course.price) > 0) return fail(res, 400, 'This course is not free', traceId);

    const existing = await checkEnrollment(userId, courseId);
    if (existing) return ok(res, existing, 'Already enrolled', traceId);

    const orderId = `free-${userId}-${courseId}`;
    const enrollment = await prisma.enrollment.create({
      data: { userId, courseId, orderId, enrollmentType: 'FREE' },
    });

    publishEvent(TOPICS.ENROLLMENT_CREATED, {
      userId,
      courseId,
      courseTitle: course.title,
      userName: (req.headers['x-user-name'] as string) || '',
      userEmail: (req.headers['x-user-email'] as string) || '',
    }).catch((err) => logger.warn({ err }, 'Failed to publish enrollment event'));

    return ok(res, enrollment, 'Enrolled successfully', traceId, 201);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'enrollFree');
  }
}

// ─── GET /api/student/courses/:courseId/enrollment-status ─────────────────────

export async function getEnrollmentStatus(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    const enrollment = await checkEnrollment(userId, courseId);
    return ok(res, { enrolled: !!enrollment, enrollment }, 'Enrollment status', traceId);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getEnrollmentStatus');
  }
}

// ─── GET /api/student/courses/:courseId/learn-data ────────────────────────────

export async function getLearnData(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          where: { lessons: { some: { isPublished: true } } },
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              where: { isPublished: true },
              orderBy: { order: 'asc' },
              select: {
                id: true, title: true, order: true, videoUrl: true,
                sourceType: true, duration: true, isFree: true,
              },
            },
          },
        },
      },
    });

    if (!course || course.status !== 'PUBLISHED') {
      return fail(res, 404, 'Course not found or not published', traceId);
    }

    const enrollment = await checkEnrollment(userId, courseId);

    const progressRecords = await prisma.lessonProgress.findMany({
      where: { userId, courseId },
    });
    const progressMap = new Map(progressRecords.map((p) => [p.lessonId, p]));

    const totalLessons = course.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
    const completedLessons = progressRecords.filter((p) => p.isCompleted).length;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    const chapters = course.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      order: ch.order,
      lessons: ch.lessons.map((l) => ({
        ...l,
        progress: progressMap.get(l.id) || null,
      })),
    }));

    return ok(res, {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        thumbnail: course.thumbnail,
        totalLessons,
        totalDuration: course.totalDuration,
      },
      enrolled: !!enrollment,
      chapters,
      progressPercent,
      completedLessons,
      totalLessons,
    }, 'Learn data fetched', traceId);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getLearnData');
  }
}

// ─── GET /api/student/courses/:courseId/progress ──────────────────────────────

export async function getCourseProgress(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { courseId } = req.params;

  try {
    const progressRecords = await prisma.lessonProgress.findMany({
      where: { userId, courseId },
    });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { totalLessons: true },
    });

    const completedLessons = progressRecords.filter((p) => p.isCompleted).length;
    const totalLessons = course?.totalLessons || 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const totalWatched = progressRecords.reduce((sum, p) => sum + p.watchedDuration, 0);

    return ok(res, {
      progressPercent,
      completedLessons,
      totalLessons,
      totalWatchedSeconds: totalWatched,
      lessons: progressRecords,
    }, 'Course progress', traceId);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getCourseProgress');
  }
}

// ─── POST /api/student/lessons/:lessonId/progress ─────────────────────────────

export async function updateLessonProgress(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { lessonId } = req.params;

  try {
    const validated = updateProgressSchema.parse(req.body);

    const lesson = await resolveLessonWithCourse(lessonId);
    if (!lesson) return fail(res, 404, 'Lesson not found', traceId);

    const courseId = lesson.chapter.course.id;

    if (!lesson.isFree) {
      const enrollment = await checkEnrollment(userId, courseId);
      if (!enrollment) return fail(res, 403, 'Not enrolled in this course', traceId);
    }

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        courseId,
        watchedDuration: validated.watchedDuration,
        lastPosition: validated.lastPosition,
      },
      update: {
        watchedDuration: validated.watchedDuration,
        lastPosition: validated.lastPosition,
      },
    });

    return ok(res, progress, 'Progress updated', traceId);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 400, err.errors[0].message, (req.headers['x-trace-id'] as string) || '');
    }
    return handlePrismaError(err, res, traceId, 'updateLessonProgress');
  }
}

// ─── POST /api/student/lessons/:lessonId/complete ─────────────────────────────

export async function completeLesson(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { lessonId } = req.params;

  try {
    const lesson = await resolveLessonWithCourse(lessonId);
    if (!lesson) return fail(res, 404, 'Lesson not found', traceId);

    const courseId = lesson.chapter.course.id;

    if (!lesson.isFree) {
      const enrollment = await checkEnrollment(userId, courseId);
      if (!enrollment) return fail(res, 403, 'Not enrolled in this course', traceId);
    }

    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    if (existing?.isCompleted) {
      return ok(res, existing, 'Already completed', traceId);
    }

    const threshold = Math.floor(lesson.duration * COMPLETION_THRESHOLD);
    if ((existing?.watchedDuration || 0) < threshold && lesson.duration > 0) {
      return fail(res, 400, `Watch at least ${Math.round(COMPLETION_THRESHOLD * 100)}% of the lesson to complete`, traceId);
    }

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId, lessonId, courseId,
        isCompleted: true,
        completedAt: new Date(),
        watchedDuration: existing?.watchedDuration || 0,
        lastPosition: existing?.lastPosition || 0,
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    publishEvent(TOPICS.LESSON_COMPLETED, {
      userId,
      lessonId,
      lessonTitle: lesson.title,
      courseId,
      courseTitle: lesson.chapter.course.title,
    }).catch((err) => logger.warn({ err }, 'Failed to publish lesson completed event'));

    const allLessonsCount = lesson.chapter.course.totalLessons;
    const completedCount = await prisma.lessonProgress.count({
      where: { userId, courseId, isCompleted: true },
    });

    if (completedCount >= allLessonsCount && allLessonsCount > 0) {
      publishEvent(TOPICS.COURSE_COMPLETED, {
        userId,
        courseId,
        courseTitle: lesson.chapter.course.title,
        userName: (req.headers['x-user-name'] as string) || '',
        userEmail: (req.headers['x-user-email'] as string) || '',
      }).catch((err) => logger.warn({ err }, 'Failed to publish course completed event'));
    }

    return ok(res, { ...progress, courseCompleted: completedCount >= allLessonsCount }, 'Lesson completed', traceId);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'completeLesson');
  }
}

// ─── GET /api/student/my-courses ──────────────────────────────────────────────

export async function getMyCourses(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true, title: true, slug: true, thumbnail: true,
            totalLessons: true, totalDuration: true, level: true,
            instructorId: true,
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const courseIds = enrollments.map((e) => e.courseId);

    const progressAgg = await prisma.lessonProgress.groupBy({
      by: ['courseId'],
      where: { userId, courseId: { in: courseIds } },
      _count: { _all: true },
      _sum: { watchedDuration: true },
    });

    const completedAgg = await prisma.lessonProgress.groupBy({
      by: ['courseId'],
      where: { userId, courseId: { in: courseIds }, isCompleted: true },
      _count: { _all: true },
    });

    const progressByCourse = new Map(progressAgg.map((p) => [p.courseId, p]));
    const completedByCourse = new Map(completedAgg.map((p) => [p.courseId, p]));

    const lastProgressByCourse = await prisma.lessonProgress.findMany({
      where: { userId, courseId: { in: courseIds } },
      orderBy: { updatedAt: 'desc' },
      distinct: ['courseId'],
      select: { courseId: true, lessonId: true, updatedAt: true },
    });
    const lastLessonMap = new Map(lastProgressByCourse.map((p) => [p.courseId, p]));

    const courses = enrollments.map((e) => {
      const totalLessons = e.course.totalLessons || 0;
      const completed = completedByCourse.get(e.courseId)?._count._all || 0;
      const progressPercent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
      const totalWatched = progressByCourse.get(e.courseId)?._sum.watchedDuration || 0;
      const lastLesson = lastLessonMap.get(e.courseId);

      return {
        ...e.course,
        enrolledAt: e.enrolledAt,
        enrollmentType: e.enrollmentType,
        progressPercent,
        completedLessons: completed,
        totalWatchedSeconds: totalWatched,
        lastLessonId: lastLesson?.lessonId || null,
        lastAccessedAt: lastLesson?.updatedAt || e.enrolledAt,
      };
    });

    return ok(res, courses, 'My courses', traceId);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getMyCourses');
  }
}
