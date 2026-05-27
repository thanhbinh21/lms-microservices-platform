import { describe, expect, it } from 'vitest';
import { foldOrderEvents, ORDER_EVENT_TYPES, type StoredOrderEvent } from './order-aggregate';

function event(version: number, eventType: string, payload: Record<string, unknown>): StoredOrderEvent {
  return {
    orderId: 'order-1',
    eventType,
    version,
    payload: payload as StoredOrderEvent['payload'],
    occurredAt: new Date(`2026-05-23T00:00:0${version}.000Z`),
  };
}

describe('foldOrderEvents', () => {
  it('rebuilds a completed order from payment events', () => {
    const state = foldOrderEvents([
      event(1, ORDER_EVENT_TYPES.ORDER_CREATED, {
        orderId: 'order-1',
        userId: 'user-1',
        courseId: 'course-1',
        instructorId: 'instructor-1',
        courseTitle: 'Course title',
        amount: 150000,
        currency: 'VND',
        vnpTxnRef: 'txn-1',
        traceId: 'trace-1',
      }),
      event(2, ORDER_EVENT_TYPES.PAYMENT_URL_GENERATED, {
        orderId: 'order-1',
        payUrl: 'https://sandbox.vnpay.vn/pay',
        expiresAt: '2026-05-23T00:15:00.000Z',
      }),
      event(3, ORDER_EVENT_TYPES.VNPAY_CALLBACK_RECEIVED, {
        orderId: 'order-1',
        callbackKind: 'IPN',
        responseCode: '00',
        transactionStatus: '00',
        transactionNo: 'vnp-1',
        bankCode: 'NCB',
      }),
      event(4, ORDER_EVENT_TYPES.PAYMENT_VERIFIED, {
        orderId: 'order-1',
        vnpTransactionNo: 'vnp-1',
        vnpBankCode: 'NCB',
        amountVerified: true,
      }),
      event(5, ORDER_EVENT_TYPES.ORDER_COMPLETED, {
        orderId: 'order-1',
        paidAt: '2026-05-23T00:00:05.000Z',
      }),
    ]);

    expect(state.status).toBe('COMPLETED');
    expect(state.version).toBe(5);
    expect(state.vnpTransactionNo).toBe('vnp-1');
    expect(state.vnpBankCode).toBe('NCB');
    expect(state.paidAt?.toISOString()).toBe('2026-05-23T00:00:05.000Z');
  });

  it('rebuilds a failed order without losing callback response code', () => {
    const state = foldOrderEvents([
      event(1, ORDER_EVENT_TYPES.ORDER_CREATED, {
        orderId: 'order-1',
        userId: 'user-1',
        courseId: 'course-1',
        instructorId: 'instructor-1',
        amount: 150000,
        currency: 'VND',
        vnpTxnRef: 'txn-1',
      }),
      event(2, ORDER_EVENT_TYPES.VNPAY_CALLBACK_RECEIVED, {
        orderId: 'order-1',
        callbackKind: 'IPN',
        responseCode: '24',
        transactionStatus: '02',
      }),
      event(3, ORDER_EVENT_TYPES.ORDER_FAILED, {
        orderId: 'order-1',
        reason: 'code=24 status=02',
        responseCode: '24',
      }),
    ]);

    expect(state.status).toBe('FAILED');
    expect(state.failureReason).toBe('code=24 status=02');
    expect(state.vnpResponseCode).toBe('24');
  });
});
