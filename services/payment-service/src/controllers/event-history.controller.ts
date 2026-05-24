import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma';
import { foldOrderEvents } from '../lib/order-aggregate';

const paramsSchema = z.object({
  orderId: z.string().min(1),
});

function apiError(res: Response, code: number, message: string, traceId: string): Response {
  const response: ApiResponse<null> = { success: false, code, message, data: null, trace_id: traceId };
  return res.status(code).json(response);
}

export async function getOrderEventHistory(req: Request, res: Response): Promise<Response> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const parsed = paramsSchema.safeParse(req.params);

  if (!parsed.success) {
    return apiError(res, 400, parsed.error.issues[0]?.message || 'Invalid order id', traceId);
  }

  const { orderId } = parsed.data;

  try {
    const events = await prisma.orderEvent.findMany({
      where: { orderId },
      orderBy: { version: 'asc' },
      select: {
        id: true,
        orderId: true,
        eventType: true,
        version: true,
        payload: true,
        metadata: true,
        occurredAt: true,
        createdAt: true,
      },
    });

    if (events.length === 0) {
      return apiError(res, 404, 'Order event history not found', traceId);
    }

    const currentState = foldOrderEvents(events);
    const response: ApiResponse<{
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
      events: Array<{
        id: string;
        version: number;
        type: string;
        occurredAt: string;
        createdAt: string;
        payload: unknown;
        metadata: unknown;
      }>;
    }> = {
      success: true,
      code: 200,
      message: 'Order event history',
      data: {
        orderId,
        currentState: {
          status: currentState.status,
          version: currentState.version,
          amount: currentState.amount,
          currency: currentState.currency,
          userId: currentState.userId,
          courseId: currentState.courseId,
          instructorId: currentState.instructorId,
          paidAt: currentState.paidAt?.toISOString() ?? null,
          expiresAt: currentState.expiresAt?.toISOString() ?? null,
          vnpTxnRef: currentState.vnpTxnRef,
          vnpTransactionNo: currentState.vnpTransactionNo,
          vnpResponseCode: currentState.vnpResponseCode,
        },
        totalEvents: events.length,
        events: events.map((event) => ({
          id: event.id,
          version: event.version,
          type: event.eventType,
          occurredAt: event.occurredAt.toISOString(),
          createdAt: event.createdAt.toISOString(),
          payload: event.payload,
          metadata: event.metadata,
        })),
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, orderId }, 'getOrderEventHistory error');
    return apiError(res, 500, 'Internal server error', traceId);
  }
}
