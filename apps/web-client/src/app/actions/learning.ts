'use server';

import { callApi, type ApiResponse } from '@/lib/api-client';

const LEARNING_PREFIX = process.env.NEXT_PUBLIC_LEARNING_PREFIX || '/learning';
const LEARNING_API_PREFIX = `${LEARNING_PREFIX}/api`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LessonProgressDto {
  lessonId: string;
  isCompleted: boolean;
  lastWatched: number;
  updatedAt: string;
}

export interface LearnLessonDto {
  id: string;
  title: string;
  order: number;
  content: string | null;
  contentType: 'TEXT' | 'VIDEO' | 'YOUTUBE' | null;
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
    thumbnail: string | null;
    totalLessons: number;
    totalDuration: number;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    instructorId: string;
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
  template: {
    id: string;
    name: string;
    previewUrl: string | null;
  } | null;
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
    `${LEARNING_API_PREFIX}/courses/${courseId}/enroll`,
    { method: 'POST' },
    true,
  );
}

export async function getEnrollmentStatusAction(courseId: string) {
  return callApi<{ enrolled: boolean; enrollment: unknown }>(
    `${LEARNING_API_PREFIX}/courses/${courseId}/enrollment-status`,
    { method: 'GET' },
    true,
  );
}

export async function getLearnDataAction(courseId: string) {
  return callApi<LearnDataDto>(
    `${LEARNING_API_PREFIX}/learn/${courseId}`,
    { method: 'GET' },
    true,
  );
}

export async function getCourseProgressAction(courseId: string) {
  return callApi<LessonProgressDto[]>(
    `${LEARNING_API_PREFIX}/courses/${courseId}/progress`,
    { method: 'GET' },
    true,
  );
}

export async function updateLessonProgressAction(
  lessonId: string,
  data: { watchedDuration: number; lastPosition: number },
) {
  return callApi<LessonProgressDto>(
    `${LEARNING_API_PREFIX}/lessons/${lessonId}/progress`,
    {
      method: 'POST',
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
      template?: {
        id: string;
        name: string;
        previewUrl: string | null;
      } | null;
    } | null;
    certificates: Array<{
      id: string;
      certificateNumber: string;
      issuedAt: string;
      completedAt: string;
      template: {
        id: string;
        name: string;
        previewUrl: string | null;
      } | null;
    }>;
  }>(
    `${LEARNING_API_PREFIX}/lessons/${lessonId}/complete`,
    { method: 'POST' },
    true,
  );
}

export async function getMyCoursesAction() {
  return callApi<MyCourseSummary[]>(
    `${LEARNING_API_PREFIX}/my-enrollments`,
    { method: 'GET' },
    true,
  );
}

export async function getMyCertificatesAction() {
  return callApi<MyCertificateSummary[]>(
    `${LEARNING_API_PREFIX}/certificates`,
    { method: 'GET' },
    true,
  );
}

export interface CertificateDetail {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  completedAt: string;
  template: { id: string; name: string; previewUrl: string | null } | null;
  course: {
    id: string;
    title: string;
    slug: string;
    level: string;
    instructorId: string;
  };
}

export async function getCertificateByIdAction(certificateNumber: string): Promise<ApiResponse<CertificateDetail | null>> {
  return callApi<CertificateDetail>(
    `${LEARNING_API_PREFIX}/certificates/${encodeURIComponent(certificateNumber)}`,
    { method: 'GET' },
    true,
  );
}
