import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import type { ApiResponse } from '@lms/types';
import { randomUUID } from 'crypto';

function createCertificateNumber() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `LMS-${y}${m}${d}-${suffix}`;
}

async function computeCourseCompletion(userId: string, courseId: string) {
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

  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isCompleted = totalLessons > 0 && completedLessons >= totalLessons;

  return {
    totalLessons,
    completedLessons,
    progressPercent,
    isCompleted,
  };
}

async function issueCertificateIfEligible(params: {
  userId: string;
  courseId: string;
  enrollmentId: string;
}) {
  const { userId, courseId, enrollmentId } = params;
  const completion = await computeCourseCompletion(userId, courseId);

  if (!completion.isCompleted) {
    return {
      issued: false,
      certificate: null,
      completion,
    };
  }

  const existed = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      id: true,
      certificateNumber: true,
      issuedAt: true,
      completedAt: true,
    },
  });

  if (existed) {
    return {
      issued: false,
      certificate: existed,
      completion,
    };
  }

  const created = await prisma.certificate.create({
    data: {
      userId,
      courseId,
      enrollmentId,
      certificateNumber: createCertificateNumber(),
      completedAt: new Date(),
    },
    select: {
      id: true,
      certificateNumber: true,
      issuedAt: true,
      completedAt: true,
    },
  });

  return {
    issued: true,
    certificate: created,
    completion,
  };
}

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
      return res.status(404).json({ success: false, code: 404, message: 'Not found', data: null, trace_id: traceId });
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
    return res.status(500).json({ success: false, code: 500, message: 'Server Error', data: null, trace_id: traceId });
  }
};

export const getEnrollmentStatus = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { courseId } = req.params;
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } }
    });
    return res.status(200).json({
      success: true, code: 200, message: 'Success',
      data: { enrolled: !!enrollment, enrollment },
      trace_id: traceId
    });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Server error', data: null, trace_id: traceId });
  }
};

export const completeLesson = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { lessonId } = req.params;
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: true }
    });
    if (!lesson) return res.status(404).json({ success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId });
    
    const courseId = lesson.chapter.courseId;
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } }
    });
    if (!enrollment) return res.status(403).json({ success: false, code: 403, message: 'Not enrolled', data: null, trace_id: traceId });

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, isCompleted: true, lastWatched: 0 },
      update: { isCompleted: true }
    });

    const certificateResult = await issueCertificateIfEligible({
      userId,
      courseId,
      enrollmentId: enrollment.id,
    });

    const response: ApiResponse<{
      id: string;
      userId: string;
      lessonId: string;
      isCompleted: boolean;
      lastWatched: number;
      createdAt: Date;
      updatedAt: Date;
      courseCompleted: boolean;
      progressPercent: number;
      certificate: {
        id: string;
        certificateNumber: string;
        issuedAt: Date;
        completedAt: Date;
      } | null;
    }> = {
      success: true,
      code: 200,
      message: certificateResult.issued ? 'Target completed and certificate issued' : 'Target completed',
      data: {
        ...progress,
        courseCompleted: certificateResult.completion.isCompleted,
        progressPercent: certificateResult.completion.progressPercent,
        certificate: certificateResult.certificate,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Server error', data: null, trace_id: traceId });
  }
};

export const getMyCertificates = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      select: { id: true, courseId: true },
    });

    // Backfill: nhung khoa hoc da hoc xong tu truoc se duoc cap chung chi khi goi API lan dau.
    await Promise.all(
      enrollments.map((enrollment) =>
        issueCertificateIfEligible({
          userId,
          courseId: enrollment.courseId,
          enrollmentId: enrollment.id,
        }),
      ),
    );

    const certificates = await prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        certificateNumber: true,
        issuedAt: true,
        completedAt: true,
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            level: true,
          },
        },
      },
    });

    const response: ApiResponse<
      Array<{
        id: string;
        certificateNumber: string;
        issuedAt: Date;
        completedAt: Date;
        course: {
          id: string;
          title: string;
          slug: string;
          level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
        };
      }>
    > = {
      success: true,
      code: 200,
      message: 'Certificates fetched successfully',
      data: certificates as Array<{
        id: string;
        certificateNumber: string;
        issuedAt: Date;
        completedAt: Date;
        course: {
          id: string;
          title: string;
          slug: string;
          level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
        };
      }>,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Server error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

export const getMyCourses = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
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

    return res.status(200).json({ success: true, code: 200, message: 'OK', data, trace_id: traceId });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Server error', data: null, trace_id: traceId });
  }
};
