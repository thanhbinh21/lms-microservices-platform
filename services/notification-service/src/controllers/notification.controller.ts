import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { logger } from '@lms/logger';

/**
 * GET /notification/api/my
 * Lay danh sach notifications cua user hien tai (moi nhat truoc).
 * Query: ?unread=1  -> chi tra ve notification chua doc
 *        ?limit=20&cursor=<notificationId>  -> phan trang cursor
 */
export async function listMyNotifications(req: Request, res: Response): Promise<void> {
  const userId = res.locals.userId as string;
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10) || 20, 100);
  const cursor = req.query.cursor as string | undefined;

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const response: ApiResponse<{
      items: typeof items;
      unreadCount: number;
      nextCursor: string | null;
    }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { items, unreadCount, nextCursor },
      trace_id: traceId,
    };
    res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'listMyNotifications failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal error',
      data: null,
      trace_id: traceId,
    };
    res.status(500).json(response);
  }
}

/**
 * POST /notification/api/:id/read
 * Danh dau 1 notification cua chinh user la da doc.
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
  const userId = res.locals.userId as string;
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const id = req.params.id;

  try {
    const updated = await prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });

    const response: ApiResponse<{ updated: number }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { updated: updated.count },
      trace_id: traceId,
    };
    res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId, id }, 'markAsRead failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal error',
      data: null,
      trace_id: traceId,
    };
    res.status(500).json(response);
  }
}

/**
 * POST /notification/api/read-all
 * Danh dau tat ca notification cua user la da doc.
 */
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const userId = res.locals.userId as string;
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const updated = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    const response: ApiResponse<{ updated: number }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { updated: updated.count },
      trace_id: traceId,
    };
    res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'markAllAsRead failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal error',
      data: null,
      trace_id: traceId,
    };
    res.status(500).json(response);
  }
}

/**
 * GET /notification/api/admin/history
 * Admin xem lich su thong bao toan he thong.
 */
export async function listAdminNotifications(req: Request, res: Response): Promise<void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const page = Math.max(parseInt((req.query.page as string) || '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 100);
  const type = (req.query.type as string) || '';
  const status = (req.query.status as string) || '';
  const channel = (req.query.channel as string) || '';
  const userId = (req.query.userId as string) || '';

  try {
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (userId) where.userId = userId;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    const response: ApiResponse<{
      items: typeof items;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      trace_id: traceId,
    };
    res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'listAdminNotifications failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal error',
      data: null,
      trace_id: traceId,
    };
    res.status(500).json(response);
  }
}
