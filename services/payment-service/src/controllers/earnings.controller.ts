/**
 * Instructor Earnings API — Payment Service
 * GET /api/instructor/earnings — breakdown by course/month
 * GET /api/instructor/earnings/summary — total available balance
 */
import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { z } from 'zod';

function apiError(res: Response, code: number, message: string, traceId: string): Response {
  return res.status(code).json({ success: false, code, message, data: null, trace_id: traceId } as ApiResponse<null>);
}

const payoutProfileSchema = z.object({
  bankAccount: z.string().trim().regex(/^[0-9]{8,20}$/, 'Số tài khoản chỉ gồm 8-20 chữ số'),
  bankName: z.string().trim().min(2, 'Tên ngân hàng là bắt buộc'),
  accountHolder: z.string().trim().min(2, 'Tên chủ tài khoản là bắt buộc'),
});

function maskBankAccount(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length);
  const suffix = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${suffix}`;
}

export const getInstructorEarnings = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;

  try {
    const earnings = await prisma.instructorEarning.findMany({
      where: { instructorId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        courseId: true,
        grossAmount: true,
        platformFee: true,
        netAmount: true,
        revenueSharePct: true,
        platformFeePct: true,
        status: true,
        createdAt: true,
      },
    });

    const response: ApiResponse<
      Array<{
        id: string;
        orderId: string;
        courseId: string;
        grossAmount: number;
        platformFee: number;
        netAmount: number;
        revenueSharePct: number;
        platformFeePct: number;
        status: string;
        createdAt: Date;
      }>
    > = {
      success: true,
      code: 200,
      message: 'Earnings fetched',
      data: earnings.map((e) => ({
        ...e,
        grossAmount: e.grossAmount.toNumber(),
        platformFee: e.platformFee.toNumber(),
        netAmount: e.netAmount.toNumber(),
        revenueSharePct: e.revenueSharePct.toNumber(),
        platformFeePct: e.platformFeePct.toNumber(),
      })),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return apiError(res, 500, 'Server error', traceId);
  }
};

export const getInstructorPayoutProfile = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;

  try {
    const profile = await prisma.instructorPayoutProfile.findUnique({
      where: { instructorId },
      select: {
        bankName: true,
        bankAccountMasked: true,
        accountHolder: true,
        updatedAt: true,
      },
    });

    const response: ApiResponse<{
      bankName: string;
      bankAccountMasked: string;
      accountHolder: string;
      updatedAt: Date;
    } | null> = {
      success: true,
      code: 200,
      message: 'Payout profile fetched',
      data: profile,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch {
    return apiError(res, 500, 'Server error', traceId);
  }
};

export const upsertInstructorPayoutProfile = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;
  const parsed = payoutProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    return apiError(res, 400, parsed.error.issues[0]?.message || 'Invalid payload', traceId);
  }

  const normalizedAccount = parsed.data.bankAccount.replace(/\s+/g, '');
  const masked = maskBankAccount(normalizedAccount);

  try {
    const profile = await prisma.instructorPayoutProfile.upsert({
      where: { instructorId },
      create: {
        instructorId,
        bankName: parsed.data.bankName.trim(),
        bankAccount: normalizedAccount,
        bankAccountMasked: masked,
        accountHolder: parsed.data.accountHolder.trim(),
      },
      update: {
        bankName: parsed.data.bankName.trim(),
        bankAccount: normalizedAccount,
        bankAccountMasked: masked,
        accountHolder: parsed.data.accountHolder.trim(),
      },
      select: {
        bankName: true,
        bankAccountMasked: true,
        accountHolder: true,
        updatedAt: true,
      },
    });

    const response: ApiResponse<typeof profile> = {
      success: true,
      code: 200,
      message: 'Payout profile saved',
      data: profile,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch {
    return apiError(res, 500, 'Server error', traceId);
  }
};

export const getInstructorEarningsSummary = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;

  try {
    const [available, withdrawn] = await Promise.all([
      prisma.instructorEarning.aggregate({
        where: { instructorId, status: 'AVAILABLE' },
        _sum: { netAmount: true },
      }),
      prisma.instructorEarning.aggregate({
        where: { instructorId, status: 'WITHDRAWN' },
        _sum: { netAmount: true },
      }),
    ]);

    const totalEarned = await prisma.instructorEarning.aggregate({
      where: { instructorId },
      _sum: { netAmount: true },
      _count: true,
    });

    const response: ApiResponse<{
      totalEarned: number;
      availableBalance: number;
      withdrawnBalance: number;
      totalOrders: number;
    }> = {
      success: true,
      code: 200,
      message: 'Earnings summary fetched',
      data: {
        totalEarned: totalEarned._sum.netAmount?.toNumber() ?? 0,
        availableBalance: available._sum.netAmount?.toNumber() ?? 0,
        withdrawnBalance: withdrawn._sum.netAmount?.toNumber() ?? 0,
        totalOrders: totalEarned._count ?? 0,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return apiError(res, 500, 'Server error', traceId);
  }
};
