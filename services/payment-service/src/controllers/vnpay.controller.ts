import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { logger } from '@lms/logger';
import { loadVNPayConfig, verifyReturn, isSuccessful } from '../lib/vnpay';
import { enqueuePaymentCompletedOutbox } from '../lib/outbox';
import { getInstructorRevenueShareRatio } from '../lib/revenue-share';
import type { PaymentOrderCompletedEvent } from '@lms/kafka-client';

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
    await prisma.vNPayAudit.create({
      data: {
        orderId: order.id,
        kind: 'RETURN',
        payload: result.params,
        signature: result.signature,
        valid: result.valid,
        note: `code=${result.responseCode} status=${result.transactionStatus}`,
      },
    });

    // Dev fallback: neu IPN chua ve va NODE_ENV=development, tu cap nhat order + publish event.
    // Trong prod, chi trust IPN. Frontend poll order status de biet da COMPLETED hay chua.
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && order.status === 'PENDING' && isSuccessful(result)) {
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const completed = await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              vnpTransactionNo: result.transactionNo,
              vnpBankCode: result.bankCode,
              vnpResponseCode: result.responseCode,
              paidAt: new Date(),
            },
          });
          await enqueuePaymentCompletedOutbox(
            tx,
            buildPaymentCompletedEvent(completed, result.transactionNo),
            traceId,
          );
          return completed;
        });
        logger.info({ orderId: updated.id }, '[DEV] Marked COMPLETED via Return URL fallback');
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

  if (!result.valid) {
    return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
  }

  const order = await prisma.order.findUnique({ where: { vnpTxnRef: result.txnRef } });

  if (!order) {
    await prisma.vNPayAudit
      .create({
        data: {
          orderId: '00000000-0000-0000-0000-000000000000',
          kind: 'IPN',
          payload: result.params,
          signature: result.signature,
          valid: false,
          note: 'Order not found',
        },
      })
      .catch(() => void 0);
    return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
  }

  await prisma.vNPayAudit.create({
    data: {
      orderId: order.id,
      kind: 'IPN',
      payload: result.params,
      signature: result.signature,
      valid: true,
      note: `code=${result.responseCode} status=${result.transactionStatus}`,
    },
  });

  // Check amount
  if (Math.round(order.amount.toNumber()) !== result.amount) {
    return res.status(200).json({ RspCode: '04', Message: 'Amount invalid' });
  }

  // Idempotency: neu da xu ly -> khong cap nhat lai, nhung tra OK.
  if (order.status === 'COMPLETED') {
    return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
  }

  if (!isSuccessful(result)) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'FAILED',
        vnpResponseCode: result.responseCode,
        failureReason: `code=${result.responseCode} status=${result.transactionStatus}`,
      },
    });
    return res.status(200).json({ RspCode: '00', Message: 'Confirm Failure' });
  }

  // Order va outbox phai atomic de Kafka down khong lam mat event business-critical.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        vnpTransactionNo: result.transactionNo,
        vnpBankCode: result.bankCode,
        vnpResponseCode: result.responseCode,
        paidAt: new Date(),
      },
    });
    await enqueuePaymentCompletedOutbox(
      tx,
      buildPaymentCompletedEvent(updated, result.transactionNo),
      traceId,
    );
  });

  return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
};
