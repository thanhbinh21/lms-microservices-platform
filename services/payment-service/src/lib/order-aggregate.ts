import { Prisma } from '../generated/prisma/index.js';
import prisma from './prisma.js';

export const ORDER_EVENT_TYPES = {
  ORDER_CREATED: 'ORDER_CREATED',
  PAYMENT_URL_GENERATED: 'PAYMENT_URL_GENERATED',
  VNPAY_CALLBACK_RECEIVED: 'VNPAY_CALLBACK_RECEIVED',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  ORDER_FAILED: 'ORDER_FAILED',
  ORDER_EXPIRED: 'ORDER_EXPIRED',
  ORDER_REFUNDED: 'ORDER_REFUNDED',
} as const;

export type OrderEventType = (typeof ORDER_EVENT_TYPES)[keyof typeof ORDER_EVENT_TYPES];

export interface OrderState {
  id: string;
  userId: string;
  courseId: string;
  instructorId: string;
  courseTitle: string | null;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  vnpTxnRef: string;
  vnpPayUrl: string | null;
  vnpTransactionNo: string | null;
  vnpBankCode: string | null;
  vnpResponseCode: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  traceId: string | null;
  version: number;
}

export interface StoredOrderEvent {
  orderId: string;
  eventType: string;
  version: number;
  payload: Prisma.JsonValue;
  occurredAt: Date;
}

export interface AppendOrderEventInput {
  eventType: OrderEventType;
  payload: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
  occurredAt?: Date;
}

function asObject(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Prisma.JsonValue>;
}

function readString(payload: Record<string, Prisma.JsonValue>, key: string, fallback = ''): string {
  const value = payload[key];
  return typeof value === 'string' ? value : fallback;
}

function readNullableString(payload: Record<string, Prisma.JsonValue>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(payload: Record<string, Prisma.JsonValue>, key: string, fallback = 0): number {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readDate(value: Prisma.JsonValue): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function setVersion(state: OrderState | null, version: number): void {
  if (state) {
    state.version = version;
  }
}

export function foldOrderEvents(events: StoredOrderEvent[]): OrderState {
  if (events.length === 0) {
    throw new Error('No order events found');
  }

  let state: OrderState | null = null;

  for (const event of events) {
    const payload = asObject(event.payload);

    switch (event.eventType) {
      case ORDER_EVENT_TYPES.ORDER_CREATED:
        state = {
          id: readString(payload, 'orderId', event.orderId),
          userId: readString(payload, 'userId'),
          courseId: readString(payload, 'courseId'),
          instructorId: readString(payload, 'instructorId'),
          courseTitle: readNullableString(payload, 'courseTitle'),
          amount: readNumber(payload, 'amount'),
          currency: readString(payload, 'currency', 'VND'),
          status: 'PENDING',
          vnpTxnRef: readString(payload, 'vnpTxnRef'),
          vnpPayUrl: null,
          vnpTransactionNo: null,
          vnpBankCode: null,
          vnpResponseCode: null,
          failureReason: null,
          paidAt: null,
          expiresAt: null,
          traceId: readNullableString(payload, 'traceId'),
          version: event.version,
        };
        break;

      case ORDER_EVENT_TYPES.PAYMENT_URL_GENERATED:
        if (state) {
          state.vnpPayUrl = readNullableString(payload, 'payUrl') ?? state.vnpPayUrl;
          state.expiresAt = readDate(payload.expiresAt) ?? state.expiresAt;
        }
        setVersion(state, event.version);
        break;

      case ORDER_EVENT_TYPES.VNPAY_CALLBACK_RECEIVED:
        if (state) {
          state.vnpResponseCode = readNullableString(payload, 'responseCode') ?? state.vnpResponseCode;
          state.vnpTransactionNo = readNullableString(payload, 'transactionNo') ?? state.vnpTransactionNo;
          state.vnpBankCode = readNullableString(payload, 'bankCode') ?? state.vnpBankCode;
        }
        setVersion(state, event.version);
        break;

      case ORDER_EVENT_TYPES.PAYMENT_VERIFIED:
        if (state) {
          state.vnpTransactionNo = readNullableString(payload, 'vnpTransactionNo') ?? state.vnpTransactionNo;
          state.vnpBankCode = readNullableString(payload, 'vnpBankCode') ?? state.vnpBankCode;
        }
        setVersion(state, event.version);
        break;

      case ORDER_EVENT_TYPES.ORDER_COMPLETED:
        if (state) {
          state.status = 'COMPLETED';
          state.paidAt = readDate(payload.paidAt) ?? event.occurredAt;
        }
        setVersion(state, event.version);
        break;

      case ORDER_EVENT_TYPES.ORDER_FAILED:
        if (state) {
          state.status = 'FAILED';
          state.failureReason = readNullableString(payload, 'reason');
          state.vnpResponseCode = readNullableString(payload, 'responseCode') ?? state.vnpResponseCode;
        }
        setVersion(state, event.version);
        break;

      case ORDER_EVENT_TYPES.ORDER_EXPIRED:
        if (state) {
          state.status = 'EXPIRED';
        }
        setVersion(state, event.version);
        break;

      case ORDER_EVENT_TYPES.ORDER_REFUNDED:
        if (state) {
          state.status = 'REFUNDED';
        }
        setVersion(state, event.version);
        break;

      default:
        setVersion(state, event.version);
        break;
    }
  }

  if (!state) {
    throw new Error('Order event stream does not contain ORDER_CREATED');
  }

  return state;
}

export async function getOrderState(orderId: string): Promise<OrderState | null> {
  const events = await prisma.orderEvent.findMany({
    where: { orderId },
    orderBy: { version: 'asc' },
  });

  return events.length > 0 ? foldOrderEvents(events) : null;
}

export async function lockOrderForEventAppend(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  // Khoa projection row de Return/IPN song song khong tranh cung version event.
  await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
}

export async function appendOrderEvents(
  tx: Prisma.TransactionClient,
  orderId: string,
  events: AppendOrderEventInput[],
): Promise<number> {
  if (events.length === 0) return 0;

  const lastEvent = await tx.orderEvent.findFirst({
    where: { orderId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  let nextVersion = (lastEvent?.version ?? 0) + 1;
  for (const event of events) {
    await tx.orderEvent.create({
      data: {
        orderId,
        eventType: event.eventType,
        version: nextVersion,
        payload: event.payload,
        metadata: event.metadata,
        occurredAt: event.occurredAt ?? new Date(),
      },
    });
    nextVersion += 1;
  }

  return nextVersion - 1;
}
