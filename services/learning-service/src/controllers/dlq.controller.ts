import crypto from 'node:crypto';
import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma.js';
import { createProducer, TOPICS } from '@lms/kafka-client';

/** GET /api/admin/dlq — Danh sach failed events */
export async function listFailedEvents(req: Request, res: Response): Promise<Response | void> {
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
      prisma.failedEvent.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
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
    logger.error({ err, traceId }, 'listFailedEvents failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** GET /api/admin/dlq/stats — Thong ke failed events */
export async function getFailedEventStats(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const [byStatus, byTopic] = await Promise.all([
      prisma.failedEvent.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.failedEvent.groupBy({ by: ['topic'], _count: { id: true } }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const g of byStatus) statusMap[g.status] = g._count.id;

    const topicMap: Record<string, number> = {};
    for (const g of byTopic) topicMap[g.topic] = g._count.id;

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { byStatus: statusMap, byTopic: topicMap },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'getFailedEventStats failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** GET /api/admin/dlq/:id — Chi tiet 1 failed event */
export async function getFailedEvent(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const { id } = req.params;

  try {
    const event = await prisma.failedEvent.findUnique({ where: { id } });
    if (!event) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Failed event not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof event> = {
      success: true,
      code: 200,
      message: 'OK',
      data: event,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id, traceId }, 'getFailedEvent failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** POST /api/admin/dlq/:id/retry — Retry 1 failed event */
export async function retryFailedEvent(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const { id } = req.params;

  try {
    const event = await prisma.failedEvent.findUnique({ where: { id } });
    if (!event) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Failed event not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    // Publish lai event goc
    try {
      const producer = await createProducer();
      await producer.send({
        topic: event.topic,
        messages: [{ key: event.originalKey || undefined, value: JSON.stringify(event.payload) }],
      });
      await producer.disconnect();
    } catch (pubErr) {
      logger.error({ err: pubErr, eventId: id, topic: event.topic }, 'retryFailedEvent: publish failed');
      const response: ApiResponse<null> = {
        success: false,
        code: 500,
        message: 'Failed to re-publish event',
        data: null,
        trace_id: traceId,
      };
      return res.status(500).json(response);
    }

    const updated = await prisma.failedEvent.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        retriedAt: new Date(),
        status: 'RETRIED',
      },
    });

    logger.info({ eventId: id, topic: event.topic, traceId }, 'Admin retried failed event');

    const response: ApiResponse<typeof updated> = {
      success: true,
      code: 200,
      message: 'Event re-published to Kafka',
      data: updated,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id, traceId }, 'retryFailedEvent failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** PATCH /api/admin/dlq/:id/resolve — Danh dau da xu ly */
export async function resolveFailedEvent(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const { id } = req.params;
  const { status } = req.body as { status?: string };

  if (!status || !['RESOLVED', 'IGNORED'].includes(status)) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: 'Invalid status. Must be RESOLVED or IGNORED',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const updated = await prisma.failedEvent.update({
      where: { id },
      data: { status: status as 'RESOLVED' | 'IGNORED' },
    });

    logger.info({ eventId: id, status, traceId }, 'Admin resolved failed event');

    const response: ApiResponse<typeof updated> = {
      success: true,
      code: 200,
      message: `Failed event marked as ${status}`,
      data: updated,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id, traceId }, 'resolveFailedEvent failed');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
