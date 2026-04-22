'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { callApi } from './instructor';

const COURSE_PREFIX = '/course';

interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
  trace_id?: string;
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
      revalidateTag('courses');
    }
    return res;
  } catch (error) {
    return { success: false, code: 500, message: 'Lỗi hệ thống khi ghi danh' };
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
    return { success: false, code: 500, message: 'Lỗi khi lấy danh sách khóa học của tôi' };
  }
}

export async function getCourseProgressAction(courseId: string): Promise<ApiResponse<any>> {
  try {
    const res = await callApi<any>(
      `${COURSE_PREFIX}/api/courses/${courseId}/progress`,
      { method: 'GET' },
      true
    );
    return res;
  } catch (error) {
    return { success: false, code: 500, message: 'Lỗi lấy tiến độ' };
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
    return { success: false, code: 500, message: 'Lỗi cập nhật tiến độ' };
  }
}
