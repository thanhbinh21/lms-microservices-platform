'use server';

import { callApi } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LessonProgressDto {
  id: string;
  userId: string;
  lessonId: string;
  courseId: string;
  isCompleted: boolean;
  watchedDuration: number;
  lastPosition: number;
  completedAt: string | null;
}

export interface LearnLessonDto {
  id: string;
  title: string;
  order: number;
  videoUrl: string | null;
  sourceType: 'UPLOAD' | 'YOUTUBE';
  duration: number;
  isFree: boolean;
  progress: LessonProgressDto | null;
}

export interface LearnChapterDto {
  id: string;
  title: string;
  order: number;
  lessons: LearnLessonDto[];
}

export interface LearnDataDto {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    thumbnail: string | null;
    totalLessons: number;
    totalDuration: number;
  };
  enrolled: boolean;
  chapters: LearnChapterDto[];
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
}

export interface MyCourseSummary {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  totalLessons: number;
  totalDuration: number;
  level: string;
  instructorId: string;
  enrolledAt: string;
  enrollmentType: 'FREE' | 'PAID';
  progressPercent: number;
  completedLessons: number;
  totalWatchedSeconds: number;
  lastLessonId: string | null;
  lastAccessedAt: string;
}

export interface MyCertificateSummary {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  completedAt: string;
  course: {
    id: string;
    title: string;
    slug: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function enrollFreeAction(courseId: string) {
  return callApi<unknown>(
    `/course/api/student/courses/${courseId}/enroll-free`,
    { method: 'POST' },
    true,
  );
}

export async function getEnrollmentStatusAction(courseId: string) {
  return callApi<{ enrolled: boolean; enrollment: unknown }>(
    `/course/api/student/courses/${courseId}/enrollment-status`,
    { method: 'GET' },
    true,
  );
}

export async function getLearnDataAction(courseId: string) {
  return callApi<LearnDataDto>(
    `/course/api/student/courses/${courseId}/learn-data`,
    { method: 'GET' },
    true,
  );
}

export async function getCourseProgressAction(courseId: string) {
  return callApi<{
    progressPercent: number;
    completedLessons: number;
    totalLessons: number;
    totalWatchedSeconds: number;
    lessons: LessonProgressDto[];
  }>(
    `/course/api/student/courses/${courseId}/progress`,
    { method: 'GET' },
    true,
  );
}

export async function updateLessonProgressAction(
  lessonId: string,
  data: { watchedDuration: number; lastPosition: number },
) {
  return callApi<LessonProgressDto>(
    `/course/api/student/lessons/${lessonId}/progress`,
    {
      method: 'PUT',
      body: JSON.stringify({
        lastWatched: Math.max(
          0,
          Math.floor(
            Number.isFinite(data.watchedDuration)
              ? data.watchedDuration
              : data.lastPosition,
          ),
        ),
      }),
    },
    true,
  );
}

export async function completeLessonAction(lessonId: string) {
  return callApi<LessonProgressDto & {
    courseCompleted: boolean;
    progressPercent: number;
    certificate: {
      id: string;
      certificateNumber: string;
      issuedAt: string;
      completedAt: string;
    } | null;
  }>(
    `/course/api/student/lessons/${lessonId}/complete`,
    { method: 'POST' },
    true,
  );
}

export async function getMyCoursesAction() {
  return callApi<MyCourseSummary[]>(
    `/course/api/student/my-courses`,
    { method: 'GET' },
    true,
  );
}

export async function getMyCertificatesAction() {
  return callApi<MyCertificateSummary[]>(
    `/course/api/student/certificates`,
    { method: 'GET' },
    true,
  );
}
