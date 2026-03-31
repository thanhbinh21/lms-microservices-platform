'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';

interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  trace_id: string;
}

export interface CourseDto {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnail?: string | null;
  price: number;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  instructorId: string;
  totalLessons: number;
  totalDuration: number;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    chapters: number;
    enrollments: number;
  };
}

export interface ChapterDto {
  id: string;
  title: string;
  order: number;
  isPublished: boolean;
  lessons: LessonDto[];
}

export interface LessonDto {
  id: string;
  title: string;
  order: number;
  duration: number;
  videoUrl?: string | null;
  sourceType: 'UPLOAD' | 'YOUTUBE';
  isPublished: boolean;
  isFree: boolean;
}

export interface MediaUploadDto {
  id: string;
  filename: string;
  sourceType: 'UPLOAD' | 'YOUTUBE';
  status: 'PENDING' | 'UPLOADED' | 'PROCESSED' | 'FAILED';
  url?: string | null;
  lessonId?: string | null;
}

interface PresignedUploadDto {
  mediaId: string;
  presignedUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface CourseCurriculumDto {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  slug?: string;
  description?: string | null;
  price?: number;
  level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  instructorId?: string;
  chapters: ChapterDto[];
}

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get('accessToken')?.value;
}

async function callApi<T>(path: string, init?: RequestInit, requireAuth = false): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  if (requireAuth) {
    const token = await getAccessToken();
    if (!token) {
      return {
        success: false,
        code: 401,
        message: 'Missing access token',
        data: null,
        trace_id: '',
      };
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const result = await response.json();
  return result as ApiResponse<T>;
}

export async function getPublicCoursesAction(page = 1, limit = 20) {
  return callApi<{ courses: CourseDto[]; total: number; page: number; limit: number }>(
    `/course/api/courses?page=${page}&limit=${limit}`,
    { method: 'GET' },
  );
}

export async function getPublicCourseDetailAction(slug: string) {
  return callApi<CourseCurriculumDto>(`/course/api/courses/${slug}`, { method: 'GET' });
}

export async function getInstructorCoursesAction() {
  return callApi<CourseDto[]>(`/course/api/instructor/courses`, { method: 'GET' }, true);
}

export async function getCourseByIdAction(courseId: string) {
  return callApi<CourseDto>(`/course/api/instructor/courses/${courseId}`, { method: 'GET' }, true);
}

export async function getCourseCurriculumAction(courseId: string) {
  return callApi<CourseCurriculumDto>(`/course/api/courses/${courseId}/curriculum`, { method: 'GET' }, true);
}

export async function createCourseAction(title: string) {
  const result = await callApi<CourseDto>(
    '/course/api/courses',
    {
      method: 'POST',
      body: JSON.stringify({ title }),
    },
    true,
  );

  if (!result.success || !result.data) {
    return { success: false, message: result.message, courseId: null };
  }

  return { success: true, message: result.message, courseId: result.data.id };
}

export async function updateCourseAction(courseId: string, data: Partial<CourseDto>) {
  const result = await callApi<CourseDto>(
    `/course/api/courses/${courseId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}`);
  return { success: result.success, message: result.message };
}

export async function updateCurriculumOrderAction(courseId: string, orderedChapterIds: string[]) {
  const payload = {
    chapters: orderedChapterIds.map((id, order) => ({ id, order })),
  };

  const result = await callApi<null>(
    `/course/api/courses/${courseId}/chapters/reorder`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}/curriculum`);
  return { success: result.success, message: result.message };
}

export async function createChapterAction(courseId: string, title: string) {
  const result = await callApi<ChapterDto>(
    `/course/api/courses/${courseId}/chapters`,
    {
      method: 'POST',
      body: JSON.stringify({ title }),
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}/curriculum`);
  return { success: result.success, message: result.message, chapter: result.data };
}

export async function createLessonAction(courseId: string, chapterId: string, title: string, isFree = false) {
  const result = await callApi<LessonDto>(
    `/course/api/courses/${courseId}/chapters/${chapterId}/lessons`,
    {
      method: 'POST',
      body: JSON.stringify({ title, isFree }),
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}/curriculum`);
  return { success: result.success, message: result.message, lesson: result.data };
}

export async function updateLessonAction(
  courseId: string,
  chapterId: string,
  lessonId: string,
  data: Partial<Pick<LessonDto, 'title' | 'duration' | 'isPublished' | 'isFree' | 'videoUrl' | 'sourceType'>>,
) {
  const result = await callApi<LessonDto>(
    `/course/api/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}/curriculum`);
  return { success: result.success, message: result.message, lesson: result.data };
}

export async function requestLessonUploadAction(params: {
  filename: string;
  mimeType: string;
  size: number;
  courseId: string;
  lessonId: string;
}) {
  return callApi<PresignedUploadDto>(
    `/media/api/upload/presigned`,
    {
      method: 'POST',
      body: JSON.stringify({
        filename: params.filename,
        mimeType: params.mimeType,
        size: params.size,
        type: 'VIDEO',
        courseId: params.courseId,
        lessonId: params.lessonId,
      }),
    },
    true,
  );
}

export async function confirmLessonUploadAction(mediaId: string) {
  return callApi<MediaUploadDto>(
    `/media/api/upload/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ mediaId }),
    },
    true,
  );
}

export async function registerYoutubeMediaAction(params: {
  title: string;
  youtubeUrl: string;
  courseId: string;
  lessonId: string;
}) {
  return callApi<MediaUploadDto>(
    `/media/api/upload/external`,
    {
      method: 'POST',
      body: JSON.stringify({
        filename: params.title,
        sourceType: 'YOUTUBE',
        externalUrl: params.youtubeUrl,
        courseId: params.courseId,
        lessonId: params.lessonId,
      }),
    },
    true,
  );
}

export async function getLessonPlaybackAction(lessonId: string, requireAuth = false) {
  return callApi<{ lessonId: string; courseId: string; videoUrl: string; sourceType: 'UPLOAD' | 'YOUTUBE'; isFree: boolean; duration: number }>(
    `/course/api/lessons/${lessonId}/playback`,
    { method: 'GET' },
    requireAuth,
  );
}
