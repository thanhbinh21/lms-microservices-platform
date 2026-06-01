import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { handlePrismaError } from '../lib/prisma-errors.js';
import { createInternalNotification, fetchAdminUsers, fetchUsersByIds } from '../lib/auth-client.js';
import { writeAuditLog } from '../lib/audit.js';

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

const createPayoutSchema = z.object({
  amount: z.coerce.number().positive('Số tiền rút phải lớn hơn 0'),
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

async function selectEarningsForAmount(
  client: Pick<typeof prisma, 'instructorEarning'>,
  instructorId: string,
  amount: number,
  status: 'AVAILABLE' | 'PENDING',
) {
  const earnings = await client.instructorEarning.findMany({
    where: { instructorId, status },
    orderBy: { createdAt: 'asc' },
    select: { id: true, netAmount: true },
  });

  const selected: string[] = [];
  let total = 0;
  for (const earning of earnings) {
    const nextAmount = toAmount(earning.netAmount);
    if (total + nextAmount > amount) continue;
    selected.push(earning.id);
    total += nextAmount;
    if (total === amount) break;
  }

  return { selected, total };
}

async function getAvailableBalance(instructorId: string): Promise<number> {
  const available = await prisma.instructorEarning.aggregate({
    where: { instructorId, status: 'AVAILABLE' },
    _sum: { netAmount: true },
  });
  return available._sum.netAmount?.toNumber() ?? 0;
}

function mapPayout<T extends { amount: unknown }>(payout: T): Omit<T, 'amount'> & { amount: number } {
  return { ...payout, amount: toAmount(payout.amount as { toNumber: () => number } | number) };
}

export async function listMyPayouts(req: Request, res: Response) {
  const traceId = readHeaderValue(req.headers['x-trace-id']) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;

  try {
    const items = await prisma.payout.findMany({
      where: { instructorId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const response: ApiResponse<Array<ReturnType<typeof mapPayout>>> = {
      success: true,
      code: 200,
      message: 'Payout requests fetched',
      data: items.map(mapPayout),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listMyPayouts');
  }
}

export async function createPayout(req: Request, res: Response) {
  const traceId = readHeaderValue(req.headers['x-trace-id']) || crypto.randomUUID();
  const instructorId = res.locals.userId as string;
  const parsed = createPayoutSchema.safeParse(req.body);

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
    const amount = Math.round(parsed.data.amount);
    const [profile, pending, availableBalance] = await Promise.all([
      prisma.instructorPayoutProfile.findUnique({ where: { instructorId } }),
      prisma.payout.findFirst({ where: { instructorId, status: 'PENDING' } }),
      getAvailableBalance(instructorId),
    ]);

    if (!profile) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Vui lòng lưu thông tin nhận thanh toán trước khi rút tiền',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    if (pending) {
      const response: ApiResponse<null> = {
        success: false,
        code: 409,
        message: 'Bạn đang có một yêu cầu rút tiền chờ xử lý',
        data: null,
        trace_id: traceId,
      };
      return res.status(409).json(response);
    }

    if (amount > availableBalance) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Số tiền rút vượt quá số dư khả dụng',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const selected = await selectEarningsForAmount(prisma, instructorId, amount, 'AVAILABLE');
    if (selected.total !== amount || selected.selected.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Số tiền rút hiện tại cần khớp với các khoản thu nhập khả dụng',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const payout = await prisma.$transaction(async (tx) => {
      await tx.instructorEarning.updateMany({
        where: { id: { in: selected.selected }, instructorId, status: 'AVAILABLE' },
        data: { status: 'PENDING' },
      });

      return tx.payout.create({
        data: {
          instructorId,
          amount,
          bankAccountMasked: profile.bankAccountMasked,
          status: 'PENDING',
        },
      });
    });

    await writeAuditLog({
      actorId: instructorId,
      actorRole: 'INSTRUCTOR',
      action: 'PAYOUT_REQUEST_CREATED',
      resourceType: 'PAYOUT',
      resourceId: payout.id,
      targetLabel: instructorId,
      payload: { amount, selectedEarningIds: selected.selected },
      traceId,
    });

    const admins = await fetchAdminUsers(traceId);
    await Promise.all(
      admins.map((admin) =>
        createInternalNotification({
          userId: admin.id,
          title: 'Có yêu cầu rút tiền mới',
          body: 'Giảng viên vừa tạo yêu cầu rút tiền cần xử lý.',
          eventId: `payout-request:${payout.id}:${admin.id}`,
          metadata: { payoutId: payout.id, instructorId, amount, route: '/admin/payouts' },
          traceId,
        }),
      ),
    );

    const response: ApiResponse<ReturnType<typeof mapPayout>> = {
      success: true,
      code: 201,
      message: 'Payout request created',
      data: mapPayout(payout),
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'createPayout');
  }
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

    if (existing.status === 'PAID' || existing.status === 'REJECTED') {
      const response: ApiResponse<null> = {
        success: false,
        code: 409,
        message: 'Payout is already finalized',
        data: null,
        trace_id: traceId,
      };
      return res.status(409).json(response);
    }

    if (parsed.data.status === 'REJECTED' && !parsed.data.adminNote) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Cần nhập lý do khi từ chối yêu cầu rút tiền',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const nextStatus = parsed.data.status;
    const payout = await prisma.$transaction(async (tx) => {
      const shouldRelease = nextStatus === 'REJECTED';
      const shouldWithdraw = nextStatus === 'PAID';

      if (shouldRelease || shouldWithdraw) {
        const selected = await selectEarningsForAmount(tx, existing.instructorId, toAmount(existing.amount), 'PENDING');
        if (selected.total !== toAmount(existing.amount)) {
          throw new Error('Payout earning reservation is not consistent');
        }

        await tx.instructorEarning.updateMany({
          where: { id: { in: selected.selected }, instructorId: existing.instructorId, status: 'PENDING' },
          data: { status: shouldWithdraw ? 'WITHDRAWN' : 'AVAILABLE' },
        });
      }

      return tx.payout.update({
        where: { id },
        data: {
          status: nextStatus,
          adminNote: parsed.data.adminNote ?? existing.adminNote,
          processedAt: new Date(),
        },
      });
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

    await createInternalNotification({
      userId: payout.instructorId,
      title:
        nextStatus === 'REJECTED'
          ? 'Yêu cầu rút tiền bị từ chối'
          : nextStatus === 'PAID'
            ? 'Yêu cầu rút tiền đã thanh toán'
            : 'Yêu cầu rút tiền đã được duyệt',
      body:
        nextStatus === 'REJECTED'
          ? parsed.data.adminNote || 'Admin đã từ chối yêu cầu rút tiền của bạn.'
          : nextStatus === 'PAID'
            ? 'Khoản rút tiền của bạn đã được đánh dấu là đã thanh toán.'
            : 'Yêu cầu rút tiền của bạn đã được duyệt và đang chờ thanh toán.',
      eventId: `payout-update:${payout.id}:${nextStatus}`,
      metadata: { payoutId: payout.id, status: nextStatus, route: '/instructor/settings' },
      traceId,
    });

    const response: ApiResponse<ReturnType<typeof mapPayout>> = {
      success: true,
      code: 200,
      message: 'Payout updated',
      data: mapPayout(payout),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'updatePayout');
  }
}
