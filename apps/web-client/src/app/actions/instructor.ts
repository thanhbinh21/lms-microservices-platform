'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';
const AUTH_PREFIX = process.env.NEXT_PUBLIC_AUTH_PREFIX || '/auth';
/** Goi thang instructor-service (vd: http://localhost:3006) de tranh Kong khi dev / Kong chua co route. */
const INSTRUCTOR_SERVICE_URL = process.env.INSTRUCTOR_SERVICE_URL?.trim() || '';

export interface BecomeInstructorInput {
  fullName: string;
  phone: string;
  expertise: string;
  experienceYears: number;
  bio: string;
  courseTitle: string;
  courseCategory: string;
  courseDescription: string;
}

export interface InstructorRequestDto {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth?: string | null;
  address?: string | null;
  expertise: string;
  specialization: string;
  experienceYears: number;
  currentJob?: string | null;
  bio: string;
  github?: string | null;
  linkedin?: string | null;
  website?: string | null;
  youtube?: string | null;
  cvFile?: string | null;
  certificateFile?: string | null;
  identityCard?: string | null;
  avatar?: string | null;
  courseTitle: string;
  courseCategory: string;
  courseDescription: string;
  targetStudents?: string | null;
  status: string;
  createdAt: string;
}

export interface InstructorRequestStatsDto {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  trace_id: string;
}

interface AccessTokenPayload {
  userId: string;
  role: string;
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
  createdAt?: string;
  updatedAt?: string;
  chapters: ChapterDto[];
}

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get('accessToken')?.value;
}

function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as AccessTokenPayload;
    return payload;
  } catch {
    return null;
  }
}

async function writeAuthCookies(params: { accessToken?: string; refreshToken?: string }) {
  const cookieStore = await cookies();

  if (params.accessToken) {
    cookieStore.set('accessToken', params.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });
  }

  if (params.refreshToken) {
    cookieStore.set('refreshToken', params.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  }
}

async function refreshAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;

  if (!refreshToken) {
    return undefined;
  }

  const response = await fetch(`${GATEWAY_URL}${AUTH_PREFIX}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    return undefined;
  }

  const nextAccessToken = result?.data?.accessToken as string | undefined;
  const nextRefreshToken = result?.data?.refreshToken as string | undefined;

  if (!nextAccessToken || !nextRefreshToken) {
    return undefined;
  }

  await writeAuthCookies({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
  return nextAccessToken;
}

export async function callApi<T>(
  path: string,
  init?: RequestInit,
  requireAuth = false,
  baseUrlOverride?: string,
): Promise<ApiResponse<T>> {
  const baseUrl = (baseUrlOverride ?? GATEWAY_URL).replace(/\/$/, '');
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  if (requireAuth) {
    let token = await getAccessToken();

    if (!token) {
      token = await refreshAccessToken();
    }

    if (!token) {
      return {
        success: false,
        code: 401,
        message: 'Session expired. Please login again.',
        data: null,
        trace_id: '',
      };
    }

    const decoded = decodeAccessToken(token);
    if (!decoded?.userId) {
      return {
        success: false,
        code: 401,
        message: 'Invalid access token payload.',
        data: null,
        trace_id: '',
      };
    }

    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-user-id', decoded.userId);
    headers.set('x-user-role', (decoded.role || '').toLowerCase());
  }

  let response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (requireAuth && response.status === 401) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      const decoded = decodeAccessToken(refreshedToken);
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      if (decoded?.userId) {
        headers.set('x-user-id', decoded.userId);
        headers.set('x-user-role', (decoded.role || '').toLowerCase());
      }
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
      });
    }
  }

  const text = await response.text();
  let result: ApiResponse<T>;
  try {
    result = JSON.parse(text) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      code: response.status,
      message: text.slice(0, 200) || 'Invalid response from server',
      data: null,
      trace_id: '',
    };
  }
  return result;
}

function instructorBaseUrl() {
  return INSTRUCTOR_SERVICE_URL || GATEWAY_URL;
}

export async function createInstructorRequestAction(data: BecomeInstructorInput): Promise<{ success: boolean; message: string }> {
  const result = await callApi<unknown>(
    '/instructor/request',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    true,
    instructorBaseUrl(),
  );

  return {
    success: result.success,
    message:
      result.message ||
      (result.success ? 'Đã gửi yêu cầu thành công.' : 'Không thể gửi yêu cầu đăng ký giảng viên.'),
  };
}

export async function getMyPendingInstructorRequestAction(): Promise<{
  success: boolean;
  message: string;
  request: InstructorRequestDto | null;
}> {
  const result = await callApi<{ request: InstructorRequestDto | null }>(
    '/instructor/my-request',
    { method: 'GET' },
    true,
    instructorBaseUrl(),
  );

  return {
    success: result.success,
    message: result.message,
    request: result.success && result.data ? result.data.request : null,
  };
}

export async function getInstructorRequestStatsAction(): Promise<{
  success: boolean;
  message: string;
  stats: InstructorRequestStatsDto | null;
}> {
  const result = await callApi<InstructorRequestStatsDto>(
    '/instructor/requests/stats',
    { method: 'GET' },
    true,
    instructorBaseUrl(),
  );

  return {
    success: result.success,
    message: result.message,
    stats: result.success && result.data ? result.data : null,
  };
}

export async function listInstructorRequestsAdminAction(): Promise<{
  success: boolean;
  message: string;
  requests: InstructorRequestDto[];
}> {
  const result = await callApi<InstructorRequestDto[]>(
    '/instructor/requests',
    { method: 'GET' },
    true,
    instructorBaseUrl(),
  );

  return {
    success: result.success,
    message: result.message,
    requests: result.success && Array.isArray(result.data) ? result.data : [],
  };
}

export async function getInstructorRequestByIdAdminAction(id: string): Promise<{
  success: boolean;
  message: string;
  request: InstructorRequestDto | null;
}> {
  const result = await callApi<InstructorRequestDto>(`/instructor/requests/${id}`, { method: 'GET' }, true, instructorBaseUrl());

  return {
    success: result.success,
    message: result.message,
    request: result.success && result.data ? result.data : null,
  };
}

export async function approveInstructorRequestAction(id: string): Promise<{ success: boolean; message: string }> {
  const result = await callApi<unknown>(`/instructor/approve/${id}`, { method: 'PUT' }, true, instructorBaseUrl());
  if (result.success) {
    revalidatePath('/profile');
    revalidatePath('/admin/instructor-requests');
    revalidatePath(`/admin/instructor-requests/${id}`);
  }
  return { success: result.success, message: result.message };
}

export async function rejectInstructorRequestAction(id: string): Promise<{ success: boolean; message: string }> {
  const result = await callApi<unknown>(`/instructor/reject/${id}`, { method: 'PUT' }, true, instructorBaseUrl());
  if (result.success) {
    revalidatePath('/profile');
    revalidatePath('/admin/instructor-requests');
    revalidatePath(`/admin/instructor-requests/${id}`);
  }
  return { success: result.success, message: result.message };
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
  return { success: result.success, message: result.message, data: result.data };
}

export async function publishCourseAction(courseId: string, thumbnail?: string) {
  const result = await callApi<CourseDto>(
    `/course/api/courses/${courseId}/publish`,
    {
      method: 'POST',
      body: JSON.stringify(thumbnail ? { thumbnail } : {}),
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}`);
  revalidatePath('/courses');
  return { success: result.success, message: result.message, data: result.data };
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

export async function updateChapterAction(courseId: string, chapterId: string, data: Partial<Pick<ChapterDto, 'title' | 'isPublished'>>) {
  const result = await callApi<ChapterDto>(
    `/course/api/courses/${courseId}/chapters/${chapterId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}/curriculum`);
  return { success: result.success, message: result.message, chapter: result.data };
}

export async function deleteChapterAction(courseId: string, chapterId: string) {
  const result = await callApi<null>(
    `/course/api/courses/${courseId}/chapters/${chapterId}`,
    {
      method: 'DELETE',
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}/curriculum`);
  return { success: result.success, message: result.message };
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

export async function deleteLessonAction(courseId: string, chapterId: string, lessonId: string) {
  const result = await callApi<null>(
    `/course/api/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`,
    {
      method: 'DELETE',
    },
    true,
  );

  revalidatePath(`/instructor/courses/${courseId}/curriculum`);
  return { success: result.success, message: result.message };
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

export async function requestCourseThumbnailUploadAction(params: {
  filename: string;
  mimeType: string;
  size: number;
  courseId: string;
}) {
  return callApi<PresignedUploadDto>(
    `/media/api/upload/presigned`,
    {
      method: 'POST',
      body: JSON.stringify({
        filename: params.filename,
        mimeType: params.mimeType,
        size: params.size,
        type: 'IMAGE',
        courseId: params.courseId,
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
