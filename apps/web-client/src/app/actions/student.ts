'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { callApi } from './instructor';

const COURSE_PREFIX = '/course';

interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  trace_id?: string;
}

export interface CourseReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  author: string;
}

export interface CourseReviewStatsDto {
  averageRating: number;
  ratingCount: number;
  distribution: Array<{
    rating: number;
    count: number;
  }>;
}

export interface CourseReviewListDto {
  reviews: CourseReviewDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: CourseReviewStatsDto;
}

export interface MyCourseReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function enrollCourseAction(courseId: string): Promise<ApiResponse<null>> {
  try {
    const res = await callApi<null>(
      `${COURSE_PREFIX}/api/enrollments`,
      {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      },
      true // requireAuth
    );

    if (res.success) {
      revalidatePath(`/courses/${courseId}`);
      revalidatePath(`/learn/${courseId}`);
      revalidatePath(`/dashboard`);
      revalidateTag('courses', 'max');
    }
    return res;
  } catch (error) {
    return { success: false, code: 500, message: 'Loi he thong khi ghi danh', data: null };
  }
}

export async function getMyEnrollmentsAction(): Promise<ApiResponse<any>> {
  try {
    const res = await callApi<any[]>(
      `${COURSE_PREFIX}/api/enrollments/my`,
      { method: 'GET' },
      true
    );
    return res;
  } catch (error) {
    return { success: false, code: 500, message: 'Loi khi lay danh sach khoa hoc cua toi', data: null };
  }
}

export async function getCourseProgressAction(courseId: string): Promise<ApiResponse<any>> {
  try {
    const res = await callApi<any>(
      `${COURSE_PREFIX}/api/student/courses/${courseId}/progress`,
      { method: 'GET' },
      true
    );
    return res;
  } catch (error) {
    return { success: false, code: 500, message: 'Loi lay tien do khoa hoc', data: null };
  }
}

export async function updateLessonProgressAction(
  lessonId: string, 
  isCompleted: boolean, 
  lastWatched: number
): Promise<ApiResponse<any>> {
  try {
    const res = await callApi<any>(
      `${COURSE_PREFIX}/api/lessons/${lessonId}/progress`,
      {
        method: 'PUT',
        body: JSON.stringify({ isCompleted, lastWatched }),
      },
      true
    );

    // Không revalidate path ở đây tránh giật frontend video
    return res;
  } catch (error) {
    return { success: false, code: 500, message: 'Loi cap nhat tien do bai hoc', data: null };
  }
}

export async function getCourseReviewsAction(
  courseId: string,
  params?: { page?: number; limit?: number; sortBy?: 'newest' | 'highest' | 'lowest' },
): Promise<ApiResponse<CourseReviewListDto>> {
  try {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sortBy) query.set('sortBy', params.sortBy);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return callApi<CourseReviewListDto>(
      `${COURSE_PREFIX}/api/courses/${courseId}/reviews${suffix}`,
      { method: 'GET' },
    );
  } catch {
    return { success: false, code: 500, message: 'Loi lay danh gia khoa hoc', data: null };
  }
}

export async function getMyCourseReviewAction(
  courseId: string,
): Promise<ApiResponse<MyCourseReviewDto | null>> {
  try {
    return callApi<MyCourseReviewDto | null>(
      `${COURSE_PREFIX}/api/courses/${courseId}/reviews/me`,
      { method: 'GET' },
      true,
    );
  } catch {
    return { success: false, code: 500, message: 'Loi lay danh gia cua ban', data: null };
  }
}

export async function upsertCourseReviewAction(
  courseId: string,
  payload: { rating: number; comment?: string },
): Promise<ApiResponse<{ review: MyCourseReviewDto; stats: CourseReviewStatsDto }>> {
  try {
    const result = await callApi<{ review: MyCourseReviewDto; stats: CourseReviewStatsDto }>(
      `${COURSE_PREFIX}/api/courses/${courseId}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true,
    );

    if (result.success) {
      revalidatePath(`/courses`);
      revalidatePath(`/learn/${courseId}`);
      revalidateTag('courses', 'max');
    }
    return result;
  } catch {
    return { success: false, code: 500, message: 'Loi luu danh gia khoa hoc', data: null };
  }
}
