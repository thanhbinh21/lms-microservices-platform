import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import { Prisma } from '../generated/prisma/index.js';
import prisma from '../lib/prisma.js';
import { logger } from '@lms/logger';
import { loadVNPayConfig, verifyReturn, isSuccessful } from '../lib/vnpay.js';
import { enqueuePaymentCompletedOutbox } from '../lib/outbox.js';
import { getInstructorRevenueShareRatio } from '../lib/revenue-share.js';
import type { PaymentOrderCompletedEvent } from '@lms/kafka-client';
import { appendOrderEvents, lockOrderForEventAppend, ORDER_EVENT_TYPES } from '../lib/order-aggregate.js';

type OrderRecord = NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>>;
type VNPayCallbackKind = 'RETURN' | 'IPN';
type CompletePaidOrderOutcome =
  | { status: 'CHECKSUM_INVALID' }
  | { status: 'NOT_FOUND' }
  | { status: 'AMOUNT_INVALID' }
  | { status: 'ALREADY_CONFIRMED' }
  | { status: 'IGNORED_STATUS'; orderStatus: string }
  | { status: 'CONFIRM_FAILURE' }
  | { status: 'CONFIRM_SUCCESS'; outboxId: string; outboxCreated: boolean };

function buildPaymentCompletedEvent(
  order: Awaited<ReturnType<typeof prisma.order.findUnique>>,
  transactionNo: string,
): PaymentOrderCompletedEvent {
  if (!order) {
    throw new Error('Order is required to build payment completed event');
  }

  return {
    order_id: order.id,
    user_id: order.userId,
    course_id: order.courseId,
    instructor_id: order.instructorId,
    amount: order.amount.toNumber(),
    currency: order.currency,
    payment_method: 'vnpay',
    vnp_txn_ref: order.vnpTxnRef,
    vnp_transaction_no: transactionNo,
    paid_at: (order.paidAt || new Date()).toISOString(),
    instructor_share_ratio: getInstructorRevenueShareRatio(),
    platform_fee_ratio: Number((1 - getInstructorRevenueShareRatio()).toFixed(4)),
  };
}

function buildCallbackPayload(
  order: OrderRecord,
  kind: VNPayCallbackKind,
  result: ReturnType<typeof verifyReturn>,
): Prisma.InputJsonObject {
  const orderAmount = Math.round(order.amount.toNumber());

  return {
    orderId: order.id,
    callbackKind: kind,
    responseCode: result.responseCode,
    transactionStatus: result.transactionStatus,
    transactionNo: result.transactionNo,
    bankCode: result.bankCode,
    amount: result.amount,
    orderAmount,
    amountVerified: orderAmount === result.amount,
    rawPayload: result.params,
    signature: result.signature,
    checksumValid: result.valid,
  };
}

async function appendCallbackAuditAndEvent(
  tx: Prisma.TransactionClient,
  order: OrderRecord,
  kind: VNPayCallbackKind,
  result: ReturnType<typeof verifyReturn>,
  traceId: string,
): Promise<void> {
  await tx.vNPayAudit.create({
    data: {
      orderId: order.id,
      kind,
      payload: result.params,
      signature: result.signature,
      valid: result.valid,
      note: `code=${result.responseCode} status=${result.transactionStatus}`,
    },
  });

  await appendOrderEvents(tx, order.id, [
    {
      eventType: ORDER_EVENT_TYPES.VNPAY_CALLBACK_RECEIVED,
      payload: buildCallbackPayload(order, kind, result),
      metadata: { traceId, source: 'vnpay', callbackKind: kind },
    },
  ]);
}

export async function completePaidOrderFromVnpay(params: {
  order: OrderRecord;
  kind: VNPayCallbackKind;
  result: ReturnType<typeof verifyReturn>;
  traceId: string;
}): Promise<CompletePaidOrderOutcome> {
  const { order, kind, result, traceId } = params;
  const source = kind === 'RETURN' ? 'vnpay-return' : 'vnpay-ipn';

  const outcome = await prisma.$transaction(async (tx): Promise<CompletePaidOrderOutcome> => {
    await lockOrderForEventAppend(tx, order.id);
    await appendCallbackAuditAndEvent(tx, order, kind, result, traceId);

    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (!current) {
      return { status: 'NOT_FOUND' };
    }

    if (!result.valid) {
      return { status: 'CHECKSUM_INVALID' };
    }

    const completedEvent = await tx.orderEvent.findFirst({
      where: { orderId: order.id, eventType: ORDER_EVENT_TYPES.ORDER_COMPLETED },
      select: { id: true },
    });
    if (current.status === 'COMPLETED' || completedEvent) {
      return { status: 'ALREADY_CONFIRMED' };
    }

    if (!isSuccessful(result)) {
      if (current.status === 'PENDING') {
        const reason = `code=${result.responseCode} status=${result.transactionStatus}`;
        await appendOrderEvents(tx, order.id, [
          {
            eventType: ORDER_EVENT_TYPES.ORDER_FAILED,
            payload: {
              orderId: order.id,
              reason,
              responseCode: result.responseCode,
            },
            metadata: { traceId, source },
          },
        ]);
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'FAILED',
            vnpResponseCode: result.responseCode,
            failureReason: reason,
          },
        });
      }
      return { status: 'CONFIRM_FAILURE' };
    }

    if (current.status !== 'PENDING') {
      return { status: 'IGNORED_STATUS', orderStatus: current.status };
    }

    if (Math.round(current.amount.toNumber()) !== result.amount) {
      return { status: 'AMOUNT_INVALID' };
    }

    // Order va outbox phai atomic de Kafka down khong lam mat event business-critical.
    const paidAt = new Date();
    await appendOrderEvents(tx, order.id, [
      {
        eventType: ORDER_EVENT_TYPES.PAYMENT_VERIFIED,
        payload: {
          orderId: order.id,
          vnpTransactionNo: result.transactionNo,
          vnpBankCode: result.bankCode,
          vnpResponseCode: result.responseCode,
          amountVerified: true,
        },
        metadata: { traceId, source },
        occurredAt: paidAt,
      },
      {
        eventType: ORDER_EVENT_TYPES.ORDER_COMPLETED,
        payload: {
          orderId: order.id,
          paidAt: paidAt.toISOString(),
          enrollmentEventPublished: false,
          outboxEnqueued: true,
        },
        metadata: { traceId, source },
        occurredAt: paidAt,
      },
    ]);

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        vnpTransactionNo: result.transactionNo,
        vnpBankCode: result.bankCode,
        vnpResponseCode: result.responseCode,
        paidAt,
      },
    });
    const outbox = await enqueuePaymentCompletedOutbox(
      tx,
      buildPaymentCompletedEvent(updated, result.transactionNo),
      traceId,
    );

    return { status: 'CONFIRM_SUCCESS', outboxId: outbox.id, outboxCreated: outbox.created };
  });

  if (outcome.status === 'CONFIRM_SUCCESS') {
    logger.info({ event: 'payment.order.completed', orderId: order.id, source }, 'payment.order.completed');
    if (outcome.outboxCreated) {
      logger.info(
        { event: 'outbox.created', orderId: order.id, outboxId: outcome.outboxId, source },
        'outbox.created',
      );
    }
  } else if (outcome.status === 'ALREADY_CONFIRMED') {
    logger.info(
      { event: 'payment.order.already_completed', orderId: order.id, source },
      'payment.order.already_completed',
    );
  }

  return outcome;
}

/**
 * GET /api/vnpay-return — user quay ve frontend sau khi thanh toan.
 * Return cung hoan tat order vi VNPay sandbox co the khong goi duoc IPN toi server demo.
 * Endpoint nay PUBLIC (khong yeu cau auth) vi VNPay redirect user qua.
 */
export const handleVNPayReturn = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const config = loadVNPayConfig();
  const result = verifyReturn(config, { query: req.query as Record<string, string> });

  logger.info(
    { event: 'vnpay.return.valid', valid: result.valid, code: result.responseCode, txnRef: result.txnRef, traceId },
    'vnpay.return.valid',
  );

  const order = result.txnRef
    ? await prisma.order.findUnique({ where: { vnpTxnRef: result.txnRef } })
    : null;

  if (order) {
    try {
      await completePaidOrderFromVnpay({ order, kind: 'RETURN', result, traceId });
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'VNPay return completion failed');
    }
  }

  const response: ApiResponse<{
    success: boolean;
    orderId: string | null;
    status: string | null;
    responseCode: string;
    transactionStatus: string;
  }> = {
    success: true,
    code: 200,
    message: 'OK',
    data: {
      success: isSuccessful(result),
      orderId: order?.id || null,
      status: order
        ? // Query lai de lay state moi nhat sau Return hoac IPN.
          (await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } }))
            ?.status || null
        : null,
      responseCode: result.responseCode,
      transactionStatus: result.transactionStatus,
    },
    trace_id: traceId,
  };
  return res.status(200).json(response);
};

/**
 * POST /api/vnpay-ipn — VNPay goi webhook S2S khi giao dich hoan tat.
 * Format response phai theo dac ta VNPay: { RspCode, Message }.
 *
 * Quy tac idempotency:
 *  - Neu order da COMPLETED tu truoc (IPN duoc goi lai) -> tra 02.
 *  - Neu khong ton tai -> 01.
 *  - Neu amount khong khop -> 04.
 *  - Neu checksum sai -> 97.
 */
export const handleVNPayIPN = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const config = loadVNPayConfig();
  // VNPay goi GET voi query string, nhung nhieu doc GhChu goi POST form. Ho tro ca 2.
  const input = Object.keys(req.query).length > 0 ? req.query : req.body || {};
  const result = verifyReturn(config, { query: input as Record<string, string> });

  logger.info(
    { event: 'vnpay.ipn.valid', valid: result.valid, code: result.responseCode, txnRef: result.txnRef, traceId },
    'vnpay.ipn.valid',
  );

  const order = result.txnRef
    ? await prisma.order.findUnique({ where: { vnpTxnRef: result.txnRef } })
    : null;

  if (!result.valid) {
    if (order) {
      await completePaidOrderFromVnpay({ order, kind: 'IPN', result, traceId })
        .catch((err) => logger.error({ err, orderId: order.id }, 'Invalid IPN audit/event append failed'));
    }
    return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
  }

  if (!order) {
    return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
  }

  const outcome = await completePaidOrderFromVnpay({ order, kind: 'IPN', result, traceId });

  if (outcome.status === 'NOT_FOUND') {
    return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
  }
  if (outcome.status === 'CHECKSUM_INVALID') {
    return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
  }
  if (outcome.status === 'AMOUNT_INVALID') {
    return res.status(200).json({ RspCode: '04', Message: 'Amount invalid' });
  }
  if (outcome.status === 'ALREADY_CONFIRMED' || outcome.status === 'IGNORED_STATUS') {
    return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
  }
  if (outcome.status === 'CONFIRM_FAILURE') {
    return res.status(200).json({ RspCode: '00', Message: 'Confirm Failure' });
  }

  return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
};
