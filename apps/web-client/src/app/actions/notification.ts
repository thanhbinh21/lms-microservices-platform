'use server';

import { callApi } from '@/lib/api-client';

const NOTIFICATION_PREFIX =
  process.env.NEXT_PUBLIC_NOTIFICATION_PREFIX || '/notification';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'PAYMENT_SUCCESS'
  | 'ENROLLMENT_CREATED'
  | 'COURSE_COMPLETED'
  | 'LESSON_COMPLETED'
  | 'SYSTEM';

export type NotificationChannel = 'IN_APP' | 'EMAIL';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'MOCKED';

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: DeliveryStatus;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  eventId: string | null;
  traceId: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationDto[];
  unreadCount: number;
  nextCursor: string | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Lay danh sach notifications cua user hien tai. */
export async function getMyNotificationsAction(options?: {
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string | null;
}) {
  const params = new URLSearchParams();
  if (options?.unreadOnly) params.set('unread', '1');
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);
  const qs = params.toString();
  const path = `${NOTIFICATION_PREFIX}/api/my${qs ? `?${qs}` : ''}`;
  return callApi<NotificationListResult>(path, { method: 'GET' }, true);
}

/** Danh dau 1 notification la da doc. */
export async function markNotificationReadAction(id: string) {
  return callApi<{ updated: number }>(
    `${NOTIFICATION_PREFIX}/api/${id}/read`,
    { method: 'POST' },
    true,
  );
}

/** Danh dau tat ca notification la da doc. */
export async function markAllNotificationsReadAction() {
  return callApi<{ updated: number }>(
    `${NOTIFICATION_PREFIX}/api/read-all`,
    { method: 'POST' },
    true,
  );
}
