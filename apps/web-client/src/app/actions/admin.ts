'use server';

import { callApi, type ApiResponse } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------

export async function getAdminUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}): Promise<ApiResponse<{ users: any[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);

  return callApi<{ users: any[]; pagination: any }>(
    `/auth/admin/users?${query.toString()}`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminUser(
  userId: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/auth/admin/users/${userId}`,
    { method: 'GET' },
    true,
  );
}

export async function updateAdminUserRole(
  userId: string,
  role: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/auth/admin/users/${userId}/role`,
    { method: 'PATCH', body: JSON.stringify({ role }) },
    true,
  );
}

export async function updateAdminUserStatus(
  userId: string,
  status: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/auth/admin/users/${userId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    true,
  );
}

export async function updateAdminUserPassword(
  userId: string,
  password: string,
): Promise<ApiResponse<{ id: string }>> {
  return callApi<{ id: string }>(
    `/auth/admin/users/${userId}/password`,
    { method: 'PATCH', body: JSON.stringify({ password }) },
    true,
  );
}

export async function getAdminUserStats(): Promise<ApiResponse<any>> {
  const res = await callApi<any>(
    `/auth/admin/stats`,
    { method: 'GET' },
    true,
  );

  if (!res.success || !res.data) return res;

  const usersByRole = (res.data.usersByRole ?? {}) as Record<string, number>;
  const usersByStatus = (res.data.usersByStatus ?? {}) as Record<string, number>;

  return {
    ...res,
    data: {
      totalUsers: res.data.totalUsers ?? 0,
      activeUsers: usersByStatus.ACTIVE ?? 0,
      studentCount: usersByRole.STUDENT ?? 0,
      instructorCount: usersByRole.INSTRUCTOR ?? 0,
      adminCount: usersByRole.ADMIN ?? 0,
      usersByRole,
      usersByStatus,
      newUsersThisMonth: res.data.newUsersThisMonth ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Course Management
// ---------------------------------------------------------------------------

export async function getAdminCourses(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<ApiResponse<{ courses: any[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);

  return callApi<{ courses: any[]; pagination: any }>(
    `/course/api/admin/courses?${query.toString()}`,
    { method: 'GET' },
    true,
  );
}

export async function updateAdminCourseStatus(
  courseId: string,
  status: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/course/api/admin/courses/${courseId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    true,
  );
}

export async function getAdminCourseStats(): Promise<ApiResponse<any>> {
  const res = await callApi<any>(
    `/course/api/admin/stats`,
    { method: 'GET' },
    true,
  );

  if (!res.success || !res.data) return res;

  const coursesByStatus = (res.data.coursesByStatus ?? {}) as Record<string, number>;

  return {
    ...res,
    data: {
      totalCourses: res.data.totalCourses ?? 0,
      publishedCourses: coursesByStatus.PUBLISHED ?? 0,
      draftCourses: coursesByStatus.DRAFT ?? 0,
      archivedCourses: coursesByStatus.ARCHIVED ?? 0,
      coursesByStatus,
      totalEnrollments: res.data.totalEnrollments ?? 0,
      totalReviews: res.data.totalReviews ?? 0,
      flaggedReviews: res.data.flaggedReviews ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Review Management
// ---------------------------------------------------------------------------

export async function getAdminReviews(params: {
  page?: number;
  limit?: number;
  isFlagged?: string;
  courseId?: string;
}): Promise<ApiResponse<{ reviews: any[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.isFlagged) query.set('isFlagged', params.isFlagged);
  if (params.courseId) query.set('courseId', params.courseId);

  return callApi<{ reviews: any[]; pagination: any }>(
    `/course/api/admin/reviews?${query.toString()}`,
    { method: 'GET' },
    true,
  );
}

export async function flagAdminReview(
  reviewId: string,
  isFlagged: boolean,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/course/api/admin/reviews/${reviewId}/flag`,
    { method: 'PATCH', body: JSON.stringify({ isFlagged }) },
    true,
  );
}

export async function deleteAdminReview(
  reviewId: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/course/api/admin/reviews/${reviewId}`,
    { method: 'DELETE' },
    true,
  );
}

// ---------------------------------------------------------------------------
// DLQ / Failed Events
// ---------------------------------------------------------------------------

export async function getAdminFailedEvents(params: {
  page?: number;
  limit?: number;
  status?: string;
  topic?: string;
}): Promise<ApiResponse<{ events: any[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.topic) query.set('topic', params.topic);

  return callApi<{ events: any[]; pagination: any }>(
    `/course/api/admin/failed-events?${query.toString()}`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminFailedEventStats(): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/course/api/admin/failed-events/stats`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminFailedEvent(
  eventId: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/course/api/admin/failed-events/${eventId}`,
    { method: 'GET' },
    true,
  );
}

export async function retryAdminFailedEvent(
  eventId: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/course/api/admin/failed-events/${eventId}/retry`,
    { method: 'POST' },
    true,
  );
}

export async function resolveAdminFailedEvent(
  eventId: string,
  status: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/course/api/admin/failed-events/${eventId}/resolve`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    true,
  );
}
