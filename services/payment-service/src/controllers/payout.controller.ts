import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import { fetchUsersByIds } from '../lib/auth-client';
import { writeAuditLog } from '../lib/audit';

const listPayoutsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID']).optional(),
  instructorId: z.string().trim().optional(),
});

const updatePayoutSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PAID']),
  adminNote: z.string().trim().max(1000).optional(),
});

function toAmount(value: { toNumber: () => number } | number) {
  return typeof value === 'number' ? value : value.toNumber();
}

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

export async function listPayouts(req: Request, res: Response) {
  const traceId = readHeaderValue(req.headers['x-trace-id']) || crypto.randomUUID();
  const parsed = listPayoutsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsed.error.issues[0]?.message || 'Query invalid',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const { page, limit, status, instructorId } = parsed.data;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (instructorId) where.instructorId = instructorId;

    const [items, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payout.count({ where }),
    ]);

    const instructorMap = await fetchUsersByIds(items.map((item) => item.instructorId), traceId);

    type PayoutListItem = Omit<(typeof items)[number], 'amount'> & {
      amount: number;
      instructorName: string | null;
      instructorEmail: string | null;
    };

    const response: ApiResponse<{
      items: PayoutListItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> = {
      success: true,
      code: 200,
      message: 'Payouts fetched',
      data: {
        items: items.map((item) => {
          const instructor = instructorMap[item.instructorId] || null;
          return {
            ...item,
            amount: toAmount(item.amount),
            instructorName: instructor?.name || null,
            instructorEmail: instructor?.email || null,
          };
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listPayouts');
  }
}

export async function updatePayout(req: Request, res: Response) {
  const traceId = readHeaderValue(req.headers['x-trace-id']) || crypto.randomUUID();
  const parsed = updatePayoutSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsed.error.issues[0]?.message || 'Body invalid',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const { id } = req.params;
    const existing = await prisma.payout.findUnique({ where: { id } });
    if (!existing) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Payout not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const nextStatus = parsed.data.status;
    const payout = await prisma.payout.update({
      where: { id },
      data: {
        status: nextStatus,
        adminNote: parsed.data.adminNote ?? existing.adminNote,
        processedAt: new Date(),
      },
    });

    await writeAuditLog({
      actorId: res.locals.userId as string,
      actorRole: 'ADMIN',
      action: `PAYOUT_${nextStatus}`,
      resourceType: 'PAYOUT',
      resourceId: payout.id,
      targetLabel: payout.instructorId,
      payload: { before: existing, after: payout },
      traceId,
    });

    const response: ApiResponse<typeof payout> = {
      success: true,
      code: 200,
      message: 'Payout updated',
      data: payout,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'updatePayout');
  }
}