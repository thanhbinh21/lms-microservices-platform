'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { callApi, type ApiResponse } from '@/lib/api-client';

export interface AdminCategoryDto {
  id: string;
  name: string;
  slug: string;
  order: number;
  createdAt?: string;
  courseCount?: number;
}

export interface AdminPayoutDto {
  id: string;
  instructorId: string;
  instructorName?: string | null;
  instructorEmail?: string | null;
  amount: number;
  bankAccountMasked: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  adminNote?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminAuditLogDto {
  id: string;
  actorId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  targetLabel?: string | null;
  payload?: unknown;
  traceId?: string | null;
  createdAt: string;
}

export interface AdminRevenueAnalyticsDto {
  from: string;
  to: string;
  grossRevenue: number;
  platformFeeRevenue: number;
  instructorNetRevenue: number;
  totalCompletedOrders: number;
  topCourses: Array<{ courseId: string; grossRevenue: number; completedOrders: number }>;
  topInstructors: Array<{ instructorId: string; grossRevenue: number; completedOrders: number }>;
}

export interface AdminNotificationHistoryDto {
  id: string;
  userId: string;
  type: string;
  channel: string;
  status: string;
  title: string;
  body: string;
  eventId?: string | null;
  traceId?: string | null;
  createdAt: string;
}

export interface AdminSystemConfigDto {
  id: string;
  key: string;
  value: unknown;
  description?: string | null;
  updatedBy?: string | null;
  updatedAt: string;
}

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
  const result = await callApi<any>(
    `/course/api/admin/courses/${courseId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    true,
  );

  if (result.success) {
    revalidateTag('courses', 'max');
    revalidateTag('categories', 'max');
    revalidatePath('/courses');
    revalidatePath('/admin/courses');
  }
  return result;
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
// Category Management
// ---------------------------------------------------------------------------

export async function getAdminCategoriesAction(): Promise<ApiResponse<AdminCategoryDto[]>> {
  return callApi<AdminCategoryDto[]>(`/course/api/categories`, { method: 'GET' }, true);
}

export async function createAdminCategoryAction(payload: { name: string; slug?: string; order?: number }): Promise<ApiResponse<AdminCategoryDto>> {
  const result = await callApi<AdminCategoryDto>(
    `/course/api/admin/categories`,
    { method: 'POST', body: JSON.stringify(payload) },
    true,
  );
  if (result.success) {
    revalidateTag('categories', 'max');
    revalidateTag('courses', 'max');
    revalidatePath('/courses');
    revalidatePath('/admin/categories');
  }
  return result;
}

export async function updateAdminCategoryAction(
  categoryId: string,
  payload: { name?: string; slug?: string; order?: number },
): Promise<ApiResponse<AdminCategoryDto>> {
  const result = await callApi<AdminCategoryDto>(
    `/course/api/admin/categories/${categoryId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    true,
  );
  if (result.success) {
    revalidateTag('categories', 'max');
    revalidateTag('courses', 'max');
    revalidatePath('/courses');
    revalidatePath('/admin/categories');
  }
  return result;
}

export async function deleteAdminCategoryAction(categoryId: string): Promise<ApiResponse<null>> {
  const result = await callApi<null>(`/course/api/admin/categories/${categoryId}`, { method: 'DELETE' }, true);
  if (result.success) {
    revalidateTag('categories', 'max');
    revalidateTag('courses', 'max');
    revalidatePath('/courses');
    revalidatePath('/admin/categories');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Review Management
// ---------------------------------------------------------------------------

export async function getAdminReviews(params: {
  page?: number;
  limit?: number;
  isFlagged?: boolean;
  courseId?: string;
  search?: string;
}): Promise<ApiResponse<{ reviews: any[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.isFlagged !== undefined) query.set('isFlagged', String(params.isFlagged));
  if (params.courseId) query.set('courseId', params.courseId);
  if (params.search) query.set('search', params.search);

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
  const result = await callApi<any>(
    `/course/api/admin/reviews/${reviewId}/flag`,
    { method: 'PATCH', body: JSON.stringify({ isFlagged }) },
    true,
  );
  if (result.success) {
    revalidateTag('courses', 'max');
    revalidatePath('/courses');
    revalidatePath('/admin/reviews');
  }
  return result;
}

export async function deleteAdminReview(
  reviewId: string,
): Promise<ApiResponse<any>> {
  const result = await callApi<any>(
    `/course/api/admin/reviews/${reviewId}`,
    { method: 'DELETE' },
    true,
  );
  if (result.success) {
    revalidateTag('courses', 'max');
    revalidatePath('/courses');
    revalidatePath('/admin/reviews');
  }
  return result;
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
    `/learning/api/admin/dlq?${query.toString()}`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminFailedEventStats(): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/learning/api/admin/dlq/stats`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminFailedEvent(
  eventId: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/learning/api/admin/dlq/${eventId}`,
    { method: 'GET' },
    true,
  );
}

export async function retryAdminFailedEvent(
  eventId: string,
): Promise<ApiResponse<{ result: 'ENROLLMENT_CREATED' | 'ENROLLMENT_ALREADY_EXISTS' }>> {
  return callApi<{ result: 'ENROLLMENT_CREATED' | 'ENROLLMENT_ALREADY_EXISTS' }>(
    `/learning/api/admin/dlq/${eventId}/retry`,
    { method: 'POST' },
    true,
  );
}

export async function resolveAdminFailedEvent(
  eventId: string,
  status: string,
): Promise<ApiResponse<any>> {
  return callApi<any>(
    `/learning/api/admin/dlq/${eventId}/resolve`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    true,
  );
}

// ---------------------------------------------------------------------------
// Payout Management
// ---------------------------------------------------------------------------

export async function getAdminPayoutsAction(params: {
  page?: number;
  limit?: number;
  status?: string;
  instructorId?: string;
}): Promise<ApiResponse<{ items: AdminPayoutDto[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.instructorId) query.set('instructorId', params.instructorId);

  return callApi<{ items: AdminPayoutDto[]; pagination: any }>(
    `/payment/api/admin/payouts?${query.toString()}`,
    { method: 'GET' },
    true,
  );
}

export async function updateAdminPayoutAction(
  payoutId: string,
  status: 'APPROVED' | 'REJECTED' | 'PAID',
  adminNote?: string,
): Promise<ApiResponse<AdminPayoutDto>> {
  return callApi<AdminPayoutDto>(
    `/payment/api/admin/payouts/${payoutId}`,
    { method: 'PATCH', body: JSON.stringify({ status, adminNote }) },
    true,
  );
}

// ---------------------------------------------------------------------------
// Audit Log Management
// ---------------------------------------------------------------------------

export async function getAdminAuditLogsAction(params: {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  actorId?: string;
}): Promise<ApiResponse<{ items: AdminAuditLogDto[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.action) query.set('action', params.action);
  if (params.resourceType) query.set('resourceType', params.resourceType);
  if (params.actorId) query.set('actorId', params.actorId);

  return callApi<{ items: AdminAuditLogDto[]; pagination: any }>(
    `/auth/admin/audit-logs?${query.toString()}`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminRevenueAnalyticsAction(params?: {
  from?: string;
  to?: string;
}): Promise<ApiResponse<AdminRevenueAnalyticsDto>> {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return callApi<AdminRevenueAnalyticsDto>(
    `/payment/api/admin/revenue-analytics${suffix}`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminNotificationHistoryAction(params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}): Promise<ApiResponse<{ items: AdminNotificationHistoryDto[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.type) query.set('type', params.type);
  if (params?.status) query.set('status', params.status);
  return callApi<{ items: AdminNotificationHistoryDto[]; pagination: any }>(
    `/notification/api/admin/history?${query.toString()}`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminSystemConfigsAction(): Promise<ApiResponse<AdminSystemConfigDto[]>> {
  return callApi<AdminSystemConfigDto[]>(
    `/auth/admin/system-configs`,
    { method: 'GET' },
    true,
  );
}

export async function upsertAdminSystemConfigAction(payload: {
  key: string;
  value: unknown;
  description?: string;
}): Promise<ApiResponse<AdminSystemConfigDto>> {
  const result = await callApi<AdminSystemConfigDto>(
    `/auth/admin/system-configs`,
    { method: 'PUT', body: JSON.stringify(payload) },
    true,
  );
  if (result.success) {
    revalidatePath('/admin/settings');
    revalidatePath('/admin/system-config');
    revalidatePath('/admin/audit-log');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Payment Order Management (Event Sourcing)
// ---------------------------------------------------------------------------

export interface AdminOrderDto {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string | null;
  instructorId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  paymentMethod: string;
  vnpTxnRef: string;
  vnpPayUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEventItemDto {
  id: string;
  version: number;
  type: string;
  occurredAt: string;
  createdAt: string;
  payload: unknown;
  metadata: unknown;
}

export interface OrderEventHistoryDto {
  orderId: string;
  currentState: {
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
    version: number;
    amount: number;
    currency: string;
    userId: string;
    courseId: string;
    instructorId: string;
    paidAt: string | null;
    expiresAt: string | null;
    vnpTxnRef: string;
    vnpTransactionNo: string | null;
    vnpResponseCode: string | null;
  };
  totalEvents: number;
  events: OrderEventItemDto[];
}

export async function getAdminOrdersAction(params?: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
}): Promise<ApiResponse<{ orders: AdminOrderDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.userId) query.set('userId', params.userId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return callApi<{ orders: AdminOrderDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    `/payment/api/admin/orders${suffix}`,
    { method: 'GET' },
    true,
  );
}

export async function getAdminOrderEventHistoryAction(
  orderId: string,
): Promise<ApiResponse<OrderEventHistoryDto>> {
  return callApi<OrderEventHistoryDto>(
    `/payment/api/admin/orders/${orderId}/events`,
    { method: 'GET' },
    true,
  );
}
