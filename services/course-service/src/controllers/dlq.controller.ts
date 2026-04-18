import crypto from 'node:crypto';
import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma';
import { publishEvent } from '../lib/kafka-producer';
import { handlePrismaError } from '../lib/prisma-errors';

/** GET /api/admin/failed-events */
export async function listFailedEvents(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    const topic = req.query.topic as string | undefined;

    const where: Record<string, unknown> = {};
    if (status && ['PENDING', 'RETRIED', 'RESOLVED', 'IGNORED'].includes(status)) {
      where.status = status;
    }
    if (topic) where.topic = topic;

    const [events, total] = await Promise.all([
      prisma.failedEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.failedEvent.count({ where }),
    ]);

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Failed events fetched',
      data: {
        events,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listFailedEvents');
  }
}

/** GET /api/admin/failed-events/stats */
export async function getFailedEventStats(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const [byStatus, byTopic] = await Promise.all([
      prisma.failedEvent.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.failedEvent.groupBy({ by: ['topic'], _count: { id: true } }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const group of byStatus) {
      statusMap[group.status] = group._count.id;
    }

    const topicMap: Record<string, number> = {};
    for (const group of byTopic) {
      topicMap[group.topic] = group._count.id;
    }

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Failed event stats fetched',
      data: { byStatus: statusMap, byTopic: topicMap },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getFailedEventStats');
  }
}

/** GET /api/admin/failed-events/:id */
export async function getFailedEvent(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const { id } = req.params;

    const event = await prisma.failedEvent.findUnique({ where: { id } });
    if (!event) {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Failed event not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Failed event fetched',
      data: event,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getFailedEvent');
  }
}

/** POST /api/admin/failed-events/:id/retry */
export async function retryFailedEvent(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const { id } = req.params;

    const event = await prisma.failedEvent.findUnique({ where: { id } });
    if (!event) {
      const notFound: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Failed event not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    await publishEvent(event.topic, event.payload as Record<string, unknown>);

    const updated = await prisma.failedEvent.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        retriedAt: new Date(),
        status: 'RETRIED',
      },
    });

    logger.info({ eventId: id, topic: event.topic }, 'Admin retried failed event');

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Event re-published to Kafka',
      data: updated,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, eventId: req.params.id }, 'Failed to retry event');
    return handlePrismaError(err, res, traceId, 'retryFailedEvent');
  }
}

/** PATCH /api/admin/failed-events/:id/resolve */
export async function resolveFailedEvent(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    if (!status || !['RESOLVED', 'IGNORED'].includes(status)) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Invalid status. Must be RESOLVED or IGNORED',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }

    const updated = await prisma.failedEvent.update({
      where: { id },
      data: { status: status as 'RESOLVED' | 'IGNORED' },
    });

    logger.info({ eventId: id, status }, 'Admin resolved failed event');

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: `Failed event marked as ${status}`,
      data: updated,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'resolveFailedEvent');
  }
}
