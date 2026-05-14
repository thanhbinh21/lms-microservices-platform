'use server';

import { revalidatePath } from 'next/cache';
import { callApi, type ApiResponse } from '@/lib/api-client';

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportTicketCategory = 'PAYMENT' | 'COURSE' | 'ACCOUNT' | 'SYSTEM' | 'OTHER';
export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface SupportTicketReplyDto {
  id: string;
  ticketId: string;
  authorId: string;
  authorRole: string;
  authorName?: string | null;
  authorEmail?: string | null;
  message: string;
  createdAt: string;
}

export interface SupportTicketDto {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  subject: string;
  description: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  replies: SupportTicketReplyDto[];
}

export async function createSupportTicketAction(payload: {
  subject: string;
  description: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
}): Promise<ApiResponse<SupportTicketDto>> {
  const result = await callApi<SupportTicketDto>(
    `/auth/support/tickets`,
    { method: 'POST', body: JSON.stringify(payload) },
    true,
  );
  if (result.success) revalidatePath('/dashboard/support');
  return result;
}

export async function getMySupportTicketsAction(): Promise<ApiResponse<SupportTicketDto[]>> {
  return callApi<SupportTicketDto[]>(
    `/auth/support/tickets/my`,
    { method: 'GET' },
    true,
  );
}

export async function getSupportTicketAction(ticketId: string): Promise<ApiResponse<SupportTicketDto>> {
  return callApi<SupportTicketDto>(
    `/auth/support/tickets/${ticketId}`,
    { method: 'GET' },
    true,
  );
}

export async function replySupportTicketAction(ticketId: string, message: string): Promise<ApiResponse<SupportTicketDto>> {
  const result = await callApi<SupportTicketDto>(
    `/auth/support/tickets/${ticketId}/replies`,
    { method: 'POST', body: JSON.stringify({ message }) },
    true,
  );
  if (result.success) {
    revalidatePath('/dashboard/support');
    revalidatePath('/admin/support');
  }
  return result;
}

export async function getAdminSupportTicketsAction(params?: {
  page?: number;
  limit?: number;
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  search?: string;
}): Promise<ApiResponse<{ items: SupportTicketDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.category) query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return callApi<{ items: SupportTicketDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    `/auth/admin/support/tickets${suffix}`,
    { method: 'GET' },
    true,
  );
}

export async function updateAdminSupportTicketAction(
  ticketId: string,
  payload: { status?: SupportTicketStatus; priority?: SupportTicketPriority },
): Promise<ApiResponse<SupportTicketDto>> {
  const result = await callApi<SupportTicketDto>(
    `/auth/admin/support/tickets/${ticketId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    true,
  );
  if (result.success) {
    revalidatePath('/admin/support');
    revalidatePath('/dashboard/support');
  }
  return result;
}

export async function replyAdminSupportTicketAction(ticketId: string, message: string): Promise<ApiResponse<SupportTicketDto>> {
  const result = await callApi<SupportTicketDto>(
    `/auth/admin/support/tickets/${ticketId}/replies`,
    { method: 'POST', body: JSON.stringify({ message }) },
    true,
  );
  if (result.success) revalidatePath('/admin/support');
  return result;
}
