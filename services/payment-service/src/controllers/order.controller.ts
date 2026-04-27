import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import type { ApiResponse, CreateOrderResult, OrderDto } from '@lms/types';
import prisma from '../lib/prisma';
import { logger } from '@lms/logger';
import { buildPayUrl, loadVNPayConfig } from '../lib/vnpay';
import { fetchCourseById } from '../lib/course-client';

const createOrderSchema = z.object({
  courseId: z.string().min(1),
  bankCode: z.string().optional(),
});

function apiError(
  res: Response,
  code: number,
  message: string,
  traceId: string,
): Response {
  const response: ApiResponse<null> = { success: false, code, message, data: null, trace_id: traceId };
  return res.status(code).json(response);
}

function toDto(order: {
  id: string;
  userId: string;
  courseId: string;
  amount: { toNumber: () => number } | number;
  currency: string;
  status: string;
  paymentMethod: string;
  vnpTxnRef: string;
  vnpPayUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OrderDto {
  const amount =
    typeof order.amount === 'number' ? order.amount : order.amount.toNumber();
  return {
    id: order.id,
    userId: order.userId,
    courseId: order.courseId,
    amount,
    currency: order.currency,
    status: order.status as OrderDto['status'],
    paymentMethod: 'vnpay',
    vnpTxnRef: order.vnpTxnRef,
    vnpPayUrl: order.vnpPayUrl,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
  };
}

/** Sinh ma TxnRef unique, phu hop VNPay (chi so hoac chu so). */
function generateTxnRef(): string {
  const now = new Date();
  const ymd =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  return `${ymd}${randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * POST /api/orders — tao order + VNPay pay URL.
 *
 * Anti-tampering: fetch price tu course-service thay vi tin gia do client gui len.
 */
export const createOrder = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, parsed.error.errors.map((e) => e.message).join(', '), traceId);
  }

  const { courseId, bankCode } = parsed.data;

  try {
    // 1) Verify course (price, status) tu course-service.
    const course = await fetchCourseById(courseId, traceId);
    if (!course) {
      return apiError(res, 404, 'Course not found', traceId);
    }
    if (course.status !== 'PUBLISHED') {
      return apiError(res, 400, 'Course is not published', traceId);
    }
    if (course.price <= 0) {
      return apiError(
        res,
        400,
        'Course is free — dung endpoint enroll-free cua course-service',
        traceId,
      );
    }

    // 2) Idempotency: neu da co order PENDING cho (user, course) va chua het han -> tra lai.
    const existingPending = await prisma.order.findFirst({
      where: { userId, courseId, status: 'PENDING', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPending) {
      const payload: CreateOrderResult = {
        orderId: existingPending.id,
        payUrl: existingPending.vnpPayUrl || '',
        amount: existingPending.amount.toNumber(),
        currency: existingPending.currency,
      };
      const response: ApiResponse<CreateOrderResult> = {
        success: true,
        code: 200,
        message: 'Reusing existing pending order',
        data: payload,
        trace_id: traceId,
      };
      return res.status(200).json(response);
    }

    // 3) Neu user da thanh toan xong khoa hoc nay -> tu choi.
    const alreadyPaid = await prisma.order.findFirst({
      where: { userId, courseId, status: 'COMPLETED' },
    });
    if (alreadyPaid) {
      return apiError(res, 409, 'You have already purchased this course', traceId);
    }

    // 4) Tao txnRef + pay URL.
    const config = loadVNPayConfig();
    const txnRef = generateTxnRef();
    const ipAddr =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const { payUrl, expireDate, params, signature } = buildPayUrl(config, {
      txnRef,
      amount: course.price,
      orderInfo: `Thanh toan khoa hoc ${course.id}`,
      ipAddr,
      bankCode,
    });

    // 5) Ghi order + audit CREATE_URL trong cung transaction.
    const order = await prisma.order.create({
      data: {
        userId,
        courseId: course.id,
        courseTitle: course.title,
        amount: course.price,
        currency: config.currency,
        status: 'PENDING',
        paymentMethod: 'VNPAY',
        vnpTxnRef: txnRef,
        vnpPayUrl: payUrl,
        expiresAt: expireDate,
        traceId,
        audits: {
          create: {
            kind: 'CREATE_URL',
            payload: params,
            signature,
            valid: true,
            note: 'Create VNPay payment URL',
          },
        },
      },
    });

    logger.info({ orderId: order.id, courseId, userId, txnRef, traceId }, 'Order created');

    const data: CreateOrderResult = {
      orderId: order.id,
      payUrl,
      amount: course.price,
      currency: config.currency,
    };
    const response: ApiResponse<CreateOrderResult> = {
      success: true,
      code: 201,
      message: 'Order created',
      data,
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    logger.error({ err, courseId, userId }, 'createOrder error');
    return apiError(res, 500, 'Internal server error', traceId);
  }
};

/**
 * GET /api/orders/:id — xem chi tiet order (phai la chu).
 */
export const getOrder = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return apiError(res, 404, 'Order not found', traceId);
    if (order.userId !== userId) return apiError(res, 403, 'Forbidden', traceId);

    const response: ApiResponse<OrderDto> = {
      success: true,
      code: 200,
      message: 'OK',
      data: toDto(order),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getOrder error');
    return apiError(res, 500, 'Internal server error', traceId);
  }
};

/**
 * GET /api/orders/my — lich su order cua user.
 */
export const getMyOrders = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const response: ApiResponse<OrderDto[]> = {
      success: true,
      code: 200,
      message: 'OK',
      data: orders.map(toDto),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId }, 'getMyOrders error');
    return apiError(res, 500, 'Internal server error', traceId);
  }
};

/**
 * POST /api/orders/analytics/revenue — tinh doanh thu tu danh sach khoa hoc (dung cho instructor dashboard).
 */
export const getRevenueAnalytics = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const { courseIds } = req.body as { courseIds: string[] };
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      const response: ApiResponse<{ totalRevenue: number }> = {
        success: true,
        code: 200,
        message: 'No courses provided',
        data: { totalRevenue: 0 },
        trace_id: traceId,
      };
      return res.status(200).json(response);
    }

    const aggregate = await prisma.order.aggregate({
      where: {
        courseId: { in: courseIds },
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
    });

    const response: ApiResponse<{ totalRevenue: number }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { totalRevenue: Number(aggregate._sum.amount ?? 0) },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'getRevenueAnalytics error');
    return apiError(res, 500, 'Internal server error', traceId);
  }
};
