'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';

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
  isPublished: boolean;
  isFree: boolean;
}

export interface CourseCurriculumDto {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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

export async function getInstructorCoursesAction() {
  return callApi<CourseDto[]>(`/course/api/instructor/courses`, { method: 'GET' }, true);
}

export async function getCourseByIdAction(courseId: string): Promise<ApiResponse<CourseDto>> {
  const response = await getInstructorCoursesAction();
  if (!response.success || !response.data) {
    return {
      success: false,
      code: response.code,
      message: response.message,
      data: null,
      trace_id: response.trace_id,
    };
  }

  const course = response.data.find((item) => item.id === courseId) || null;
  return {
    success: !!course,
    code: course ? 200 : 404,
    message: course ? 'Course fetched successfully' : 'Course not found',
    data: course,
    trace_id: response.trace_id,
  };
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
