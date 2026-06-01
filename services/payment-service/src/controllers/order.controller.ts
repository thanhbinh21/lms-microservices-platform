import { Request, Response } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { z } from 'zod';
import type { ApiResponse, ContinuePaymentResult, CreateOrderResult, OrderDto } from '@lms/types';
import { Prisma } from '../generated/prisma/index.js';
import prisma from '../lib/prisma.js';
import { logger } from '@lms/logger';
import { buildPayUrl, loadVNPayConfig } from '../lib/vnpay.js';
import { fetchCourseById, type CourseLite } from '../lib/course-client.js';
import { appendOrderEvents, lockOrderForEventAppend, ORDER_EVENT_TYPES } from '../lib/order-aggregate.js';

const createOrderSchema = z.object({
  courseId: z.string().min(1),
  bankCode: z.string().optional(),
});

const continuePaymentSchema = z.object({
  bankCode: z.string().optional(),
});

const PAYMENT_URL_MIN_VALID_MS = 0;

function apiError(
  res: Response,
  code: number,
  message: string,
  traceId: string,
): Response {
  const response: ApiResponse<null> = { success: false, code, message, data: null, trace_id: traceId };
  return res.status(code).json(response);
}

type PaymentOrderRecord = {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string | null;
  amount: { toNumber: () => number } | number;
  currency: string;
  status: string;
  paymentMethod: string;
  vnpTxnRef: string;
  vnpPayUrl: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(order: PaymentOrderRecord): OrderDto {
  const amount =
    typeof order.amount === 'number' ? order.amount : order.amount.toNumber();
  return {
    id: order.id,
    userId: order.userId,
    courseId: order.courseId,
    courseTitle: order.courseTitle,
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

function toNumberAmount(amount: { toNumber: () => number } | number): number {
  return typeof amount === 'number' ? amount : amount.toNumber();
}

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
}

function isPayUrlStillUsable(order: Pick<PaymentOrderRecord, 'status' | 'vnpPayUrl' | 'expiresAt'>, now: Date): boolean {
  if (order.status !== 'PENDING' || !order.vnpPayUrl || !order.expiresAt) return false;
  return order.expiresAt.getTime() - now.getTime() > PAYMENT_URL_MIN_VALID_MS;
}

async function lockUserCourse(tx: Prisma.TransactionClient, userId: string, courseId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${courseId}`})::bigint)`;
}

async function expirePendingOrder(
  tx: Prisma.TransactionClient,
  order: Pick<PaymentOrderRecord, 'id' | 'status'>,
  traceId: string,
  now: Date,
): Promise<void> {
  if (order.status !== 'PENDING') return;

  await lockOrderForEventAppend(tx, order.id);
  const current = await tx.order.findUnique({
    where: { id: order.id },
    select: { status: true },
  });
  if (current?.status !== 'PENDING') return;

  await appendOrderEvents(tx, order.id, [
    {
      eventType: ORDER_EVENT_TYPES.ORDER_EXPIRED,
      payload: {
        orderId: order.id,
        expiredAt: now.toISOString(),
        reason: 'payment_url_expired',
      },
      metadata: { traceId, source: 'payment-service' },
      occurredAt: now,
    },
  ]);

  await tx.order.update({
    where: { id: order.id },
    data: {
      status: 'EXPIRED',
      failureReason: 'Payment URL expired before payment completion',
    },
  });
}

async function expireStalePendingOrders(
  tx: Prisma.TransactionClient,
  userId: string,
  courseId: string,
  traceId: string,
  now: Date,
): Promise<void> {
  const staleOrders = await tx.order.findMany({
    where: {
      userId,
      courseId,
      status: 'PENDING',
      OR: [
        { expiresAt: null },
        { expiresAt: { lte: new Date(now.getTime() + PAYMENT_URL_MIN_VALID_MS) } },
        { vnpPayUrl: null },
      ],
    },
    select: { id: true, status: true },
  });

  for (const order of staleOrders) {
    await expirePendingOrder(tx, order, traceId, now);
  }
}

async function createPendingOrder(
  tx: Prisma.TransactionClient,
  params: {
    course: CourseLite;
    userId: string;
    traceId: string;
    ipAddr: string;
    bankCode?: string;
  },
): Promise<PaymentOrderRecord> {
  const config = loadVNPayConfig();
  const txnRef = generateTxnRef();
  const { course, userId, traceId, ipAddr, bankCode } = params;
  const { payUrl, expireDate, params: vnpParams, signature } = buildPayUrl(config, {
    txnRef,
    amount: course.price,
    orderInfo: `Thanh toan khoa hoc ${course.id}`,
    ipAddr,
    bankCode,
  });

  const orderId = randomUUID();
  const now = new Date();

  await appendOrderEvents(tx, orderId, [
    {
      eventType: ORDER_EVENT_TYPES.ORDER_CREATED,
      payload: {
        orderId,
        userId,
        courseId: course.id,
        instructorId: course.instructorId,
        courseTitle: course.title,
        amount: course.price,
        currency: config.currency,
        vnpTxnRef: txnRef,
        traceId,
      },
      metadata: { traceId, actorId: userId, source: 'payment-service' },
      occurredAt: now,
    },
    {
      eventType: ORDER_EVENT_TYPES.PAYMENT_URL_GENERATED,
      payload: {
        orderId,
        payUrl,
        expiresAt: expireDate.toISOString(),
        vnpParams,
        signature,
      },
      metadata: { traceId, actorId: userId, source: 'payment-service' },
      occurredAt: now,
    },
  ]);

  return tx.order.create({
    data: {
      id: orderId,
      userId,
      courseId: course.id,
      instructorId: course.instructorId,
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
          payload: vnpParams,
          signature,
          valid: true,
          note: 'Create VNPay payment URL',
        },
      },
    },
  });
}

function toCreateOrderResult(order: PaymentOrderRecord): CreateOrderResult {
  return {
    orderId: order.id,
    payUrl: order.vnpPayUrl || '',
    amount: toNumberAmount(order.amount),
    currency: order.currency,
  };
}

function toContinuePaymentResult(order: PaymentOrderRecord): ContinuePaymentResult {
  return {
    action: 'PAY',
    orderId: order.id,
    courseId: order.courseId,
    payUrl: order.vnpPayUrl || '',
    amount: toNumberAmount(order.amount),
    currency: order.currency,
  };
}

function toLearnResult(order: Pick<PaymentOrderRecord, 'id' | 'courseId' | 'amount' | 'currency'>): ContinuePaymentResult {
  return {
    action: 'LEARN',
    orderId: order.id,
    courseId: order.courseId,
    payUrl: null,
    amount: toNumberAmount(order.amount),
    currency: order.currency,
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

    const now = new Date();
    const order = await prisma.$transaction(async (tx) => {
      await lockUserCourse(tx, userId, courseId);

      const alreadyPaid = await tx.order.findFirst({
        where: { userId, courseId, status: 'COMPLETED' },
        orderBy: { paidAt: 'desc' },
      });
      if (alreadyPaid) {
        return { kind: 'ALREADY_PAID' as const, order: alreadyPaid };
      }

      await expireStalePendingOrders(tx, userId, courseId, traceId, now);

      const existingPending = await tx.order.findFirst({
        where: { userId, courseId, status: 'PENDING', expiresAt: { gt: new Date(now.getTime() + PAYMENT_URL_MIN_VALID_MS) } },
        orderBy: { createdAt: 'desc' },
      });
      if (existingPending && isPayUrlStillUsable(existingPending, now)) {
        return { kind: 'PAY' as const, order: existingPending, created: false };
      }

      return {
        kind: 'PAY' as const,
        order: await createPendingOrder(tx, {
          course,
          userId,
          traceId,
          ipAddr: getClientIp(req),
          bankCode,
        }),
        created: true,
      };
    });

    if (order.kind === 'ALREADY_PAID') {
      return apiError(res, 409, 'You have already purchased this course', traceId);
    }

    logger.info({ orderId: order.order.id, courseId, userId, traceId, created: order.created }, 'Order ready');

    const data = toCreateOrderResult(order.order);
    const response: ApiResponse<CreateOrderResult> = {
      success: true,
      code: order.created ? 201 : 200,
      message: 'Order ready for payment',
      data,
      trace_id: traceId,
    };
    return res.status(response.code).json(response);
  } catch (err) {
    logger.error({ err, courseId, userId }, 'createOrder error');
    return apiError(res, 500, 'Internal server error', traceId);
  }
};

/**
 * POST /api/orders/:id/continue — tiep tuc thanh toan nhung khong tai su dung URL da het han.
 */
export const continuePayment = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { id } = req.params;
  const parsed = continuePaymentSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return apiError(res, 400, parsed.error.errors.map((e) => e.message).join(', '), traceId);
  }

  try {
    const targetOrder = await prisma.order.findUnique({ where: { id } });
    if (!targetOrder) return apiError(res, 404, 'Order not found', traceId);
    if (targetOrder.userId !== userId) return apiError(res, 403, 'Forbidden', traceId);

    if (targetOrder.status === 'COMPLETED') {
      const response: ApiResponse<ContinuePaymentResult> = {
        success: true,
        code: 200,
        message: 'Course already purchased',
        data: toLearnResult(targetOrder),
        trace_id: traceId,
      };
      return res.status(200).json(response);
    }

    const course = await fetchCourseById(targetOrder.courseId, traceId);
    if (!course) return apiError(res, 404, 'Course not found', traceId);
    if (course.status !== 'PUBLISHED') return apiError(res, 400, 'Course is not published', traceId);
    if (course.price <= 0) return apiError(res, 400, 'Course is free', traceId);

    const now = new Date();
    const outcome = await prisma.$transaction(async (tx) => {
      await lockUserCourse(tx, userId, targetOrder.courseId);

      const alreadyPaid = await tx.order.findFirst({
        where: { userId, courseId: targetOrder.courseId, status: 'COMPLETED' },
        orderBy: { paidAt: 'desc' },
      });
      if (alreadyPaid) {
        return { kind: 'LEARN' as const, order: alreadyPaid };
      }

      const currentTarget = await tx.order.findUnique({ where: { id } });
      if (!currentTarget || currentTarget.userId !== userId) {
        return { kind: 'NOT_FOUND' as const };
      }

      if (isPayUrlStillUsable(currentTarget, now)) {
        return { kind: 'PAY' as const, order: currentTarget };
      }

      if (currentTarget.status === 'PENDING') {
        await expirePendingOrder(tx, currentTarget, traceId, now);
      }

      await expireStalePendingOrders(tx, userId, targetOrder.courseId, traceId, now);

      const existingPending = await tx.order.findFirst({
        where: {
          userId,
          courseId: targetOrder.courseId,
          status: 'PENDING',
          expiresAt: { gt: new Date(now.getTime() + PAYMENT_URL_MIN_VALID_MS) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existingPending && isPayUrlStillUsable(existingPending, now)) {
        return { kind: 'PAY' as const, order: existingPending };
      }

      return {
        kind: 'PAY' as const,
        order: await createPendingOrder(tx, {
          course,
          userId,
          traceId,
          ipAddr: getClientIp(req),
          bankCode: parsed.data.bankCode,
        }),
      };
    });

    if (outcome.kind === 'NOT_FOUND') {
      return apiError(res, 404, 'Order not found', traceId);
    }

    const data =
      outcome.kind === 'LEARN' ? toLearnResult(outcome.order) : toContinuePaymentResult(outcome.order);
    const response: ApiResponse<ContinuePaymentResult> = {
      success: true,
      code: 200,
      message: outcome.kind === 'LEARN' ? 'Course already purchased' : 'Payment URL ready',
      data,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, orderId: id, userId }, 'continuePayment error');
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

/**
 * GET /api/admin/revenue-analytics — thong ke doanh thu toan nen tang cho admin.
 */
export const getAdminRevenueAnalytics = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const fromRaw = req.query.from as string | undefined;
  const toRaw = req.query.to as string | undefined;
  const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toRaw ? new Date(toRaw) : new Date();

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return apiError(res, 400, 'Invalid date range', traceId);
  }

  try {
    const [orderAgg, earningAgg, topCourses, topInstructors] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.instructorEarning.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
        },
        _sum: { netAmount: true, platformFee: true },
      }),
      prisma.order.groupBy({
        by: ['courseId'],
        where: {
          status: 'COMPLETED',
          paidAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
      prisma.order.groupBy({
        by: ['instructorId'],
        where: {
          status: 'COMPLETED',
          paidAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
    ]);

    const response: ApiResponse<{
      from: string;
      to: string;
      grossRevenue: number;
      platformFeeRevenue: number;
      instructorNetRevenue: number;
      totalCompletedOrders: number;
      topCourses: Array<{ courseId: string; grossRevenue: number; completedOrders: number }>;
      topInstructors: Array<{ instructorId: string; grossRevenue: number; completedOrders: number }>;
    }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        grossRevenue: Number(orderAgg._sum.amount ?? 0),
        platformFeeRevenue: Number(earningAgg._sum.platformFee ?? 0),
        instructorNetRevenue: Number(earningAgg._sum.netAmount ?? 0),
        totalCompletedOrders: orderAgg._count ?? 0,
        topCourses: topCourses.map((item) => ({
          courseId: item.courseId,
          grossRevenue: Number(item._sum.amount ?? 0),
          completedOrders: item._count._all,
        })),
        topInstructors: topInstructors.map((item) => ({
          instructorId: item.instructorId,
          grossRevenue: Number(item._sum.amount ?? 0),
          completedOrders: item._count._all,
        })),
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'getAdminRevenueAnalytics error');
    return apiError(res, 500, 'Internal server error', traceId);
  }
};

/**
 * GET /api/admin/orders — danh sach order toan nen tang (chi admin).
 * Ho tro filter status, search theo userId, pagination.
 */
export const getAdminOrders = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
  const status = req.query.status as string | undefined;
  const userId = req.query.userId as string | undefined;
  const skip = (page - 1) * limit;

  try {
    const where: Record<string, unknown> = {};
    if (status && ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'REFUNDED'].includes(status)) {
      where.status = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          courseId: true,
          courseTitle: true,
          amount: true,
          currency: true,
          status: true,
          paymentMethod: true,
          vnpTxnRef: true,
          vnpPayUrl: true,
          paidAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          instructorId: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    const response: ApiResponse<{
      orders: OrderDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: {
        orders: orders.map((o) => toDto(o as PaymentOrderRecord)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err }, 'getAdminOrders error');
    return apiError(res, 500, 'Internal server error', traceId);
  }
};
