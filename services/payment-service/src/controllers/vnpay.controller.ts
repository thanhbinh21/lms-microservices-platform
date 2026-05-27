import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import { Prisma } from '../generated/prisma';
import prisma from '../lib/prisma';
import { logger } from '@lms/logger';
import { loadVNPayConfig, verifyReturn, isSuccessful } from '../lib/vnpay';
import { enqueuePaymentCompletedOutbox } from '../lib/outbox';
import { getInstructorRevenueShareRatio } from '../lib/revenue-share';
import type { PaymentOrderCompletedEvent } from '@lms/kafka-client';
import { appendOrderEvents, lockOrderForEventAppend, ORDER_EVENT_TYPES } from '../lib/order-aggregate';

type OrderRecord = NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>>;
type VNPayCallbackKind = 'RETURN' | 'IPN';

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

/**
 * GET /api/vnpay-return — user quay ve frontend sau khi thanh toan.
 * Lam viec:
 *  - Xac minh checksum.
 *  - Neu NODE_ENV=development VA checksum valid VA txn success
 *    -> update order + publish Kafka event (dev fallback khi khong co IPN).
 *    Day la pattern duoc kich hoat boi lua chon "default_local" cua user:
 *    local sandbox VNPay khong goi duoc IPN qua localhost.
 *  - Luon ghi audit.
 *  - Tra ve JSON {status, orderId} cho frontend render trang ket qua.
 *
 * Endpoint nay PUBLIC (khong yeu cau auth) vi VNPay redirect user qua.
 */
export const handleVNPayReturn = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const config = loadVNPayConfig();
  const result = verifyReturn(config, { query: req.query as Record<string, string> });

  logger.info(
    { valid: result.valid, code: result.responseCode, txnRef: result.txnRef, traceId },
    'VNPay return callback',
  );

  const order = result.txnRef
    ? await prisma.order.findUnique({ where: { vnpTxnRef: result.txnRef } })
    : null;

  if (order) {
    try {
      await prisma.$transaction(async (tx) => {
        await lockOrderForEventAppend(tx, order.id);
        await appendCallbackAuditAndEvent(tx, order, 'RETURN', result, traceId);
      });
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'VNPay return audit/event append failed');
    }

    // Dev fallback chi dung khi sandbox khong goi duoc IPN ve localhost.
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && isSuccessful(result)) {
      try {
        const updated = await prisma.$transaction(async (tx) => {
          await lockOrderForEventAppend(tx, order.id);

          const current = await tx.order.findUnique({ where: { id: order.id } });
          if (!current || current.status !== 'PENDING') {
            return current;
          }

          const completedEvent = await tx.orderEvent.findFirst({
            where: { orderId: order.id, eventType: ORDER_EVENT_TYPES.ORDER_COMPLETED },
            select: { id: true },
          });
          if (completedEvent) {
            return current;
          }

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
              metadata: { traceId, source: 'vnpay-return-dev-fallback' },
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
              metadata: { traceId, source: 'vnpay-return-dev-fallback' },
              occurredAt: paidAt,
            },
          ]);

          const completed = await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              vnpTransactionNo: result.transactionNo,
              vnpBankCode: result.bankCode,
              vnpResponseCode: result.responseCode,
              paidAt,
            },
          });
          await enqueuePaymentCompletedOutbox(
            tx,
            buildPaymentCompletedEvent(completed, result.transactionNo),
            traceId,
          );
          return completed;
        });

        if (updated?.status === 'COMPLETED') {
          logger.info({ orderId: updated.id }, '[DEV] Marked COMPLETED via Return URL fallback');
        }
      } catch (err) {
        logger.error({ err, orderId: order.id }, 'Dev fallback update failed');
      }
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
        ? // Query lai de chac chan lay state moi nhat (co the da COMPLETED boi dev fallback hoac IPN).
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
    { valid: result.valid, code: result.responseCode, txnRef: result.txnRef, traceId },
    'VNPay IPN callback',
  );

  const order = await prisma.order.findUnique({ where: { vnpTxnRef: result.txnRef } });

  if (!result.valid) {
    if (order) {
      await prisma
        .$transaction(async (tx) => {
          await lockOrderForEventAppend(tx, order.id);
          await appendCallbackAuditAndEvent(tx, order, 'IPN', result, traceId);
        })
        .catch((err) => logger.error({ err, orderId: order.id }, 'Invalid IPN audit/event append failed'));
    }
    return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
  }

  if (!order) {
    return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
  }

  const outcome = await prisma.$transaction(async (tx) => {
    await lockOrderForEventAppend(tx, order.id);
    await appendCallbackAuditAndEvent(tx, order, 'IPN', result, traceId);

    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (!current) {
      return 'NOT_FOUND' as const;
    }

    if (Math.round(current.amount.toNumber()) !== result.amount) {
      return 'AMOUNT_INVALID' as const;
    }

    const completedEvent = await tx.orderEvent.findFirst({
      where: { orderId: order.id, eventType: ORDER_EVENT_TYPES.ORDER_COMPLETED },
      select: { id: true },
    });
    if (current.status === 'COMPLETED' || completedEvent) {
      return 'ALREADY_CONFIRMED' as const;
    }

    if (!isSuccessful(result)) {
      if (current.status !== 'FAILED') {
        const reason = `code=${result.responseCode} status=${result.transactionStatus}`;
        await appendOrderEvents(tx, order.id, [
          {
            eventType: ORDER_EVENT_TYPES.ORDER_FAILED,
            payload: {
              orderId: order.id,
              reason,
              responseCode: result.responseCode,
            },
            metadata: { traceId, source: 'vnpay-ipn' },
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
      return 'CONFIRM_FAILURE' as const;
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
        metadata: { traceId, source: 'vnpay-ipn' },
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
        metadata: { traceId, source: 'vnpay-ipn' },
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
    await enqueuePaymentCompletedOutbox(
      tx,
      buildPaymentCompletedEvent(updated, result.transactionNo),
      traceId,
    );

    return 'CONFIRM_SUCCESS' as const;
  });

  if (outcome === 'NOT_FOUND') {
    return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
  }
  if (outcome === 'AMOUNT_INVALID') {
    return res.status(200).json({ RspCode: '04', Message: 'Amount invalid' });
  }
  if (outcome === 'ALREADY_CONFIRMED') {
    return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
  }
  if (outcome === 'CONFIRM_FAILURE') {
    return res.status(200).json({ RspCode: '00', Message: 'Confirm Failure' });
  }

  return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
};
