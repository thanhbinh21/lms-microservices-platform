/**
 * Instructor Earnings API — Payment Service
 * GET /api/instructor/earnings — breakdown by course/month
 * GET /api/instructor/earnings/summary — total available balance
 */
import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';

function apiError(res: Response, code: number, message: string, traceId: string): Response {
  return res.status(code).json({ success: false, code, message, data: null, trace_id: traceId } as ApiResponse<null>);
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
      })),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
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
