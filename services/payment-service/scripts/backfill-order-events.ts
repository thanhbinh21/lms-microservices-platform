import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PrismaClientType = InstanceType<typeof import('../src/generated/prisma/index.js').PrismaClient>;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serviceDir = path.resolve(scriptDir, '..');

function loadEnvFile(): void {
  const envPath = path.join(serviceDir, '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

function readAmount(payload: Record<string, unknown>): number {
  const raw = readString(payload, 'vnp_Amount');
  const parsed = Number.parseInt(raw || '0', 10);
  return Number.isFinite(parsed) ? Math.round(parsed / 100) : 0;
}

function callbackPayload(order: Awaited<ReturnType<PrismaClientType['order']['findFirst']>>, audit: {
  kind: string;
  payload: unknown;
  signature: string | null;
  valid: boolean;
}): Record<string, unknown> {
  if (!order) {
    throw new Error('Order is required for callback payload');
  }

  const rawPayload = asObject(audit.payload);
  const callbackAmount = readAmount(rawPayload);
  const orderAmount = Math.round(order.amount.toNumber());

  return {
    orderId: order.id,
    callbackKind: audit.kind,
    responseCode: readString(rawPayload, 'vnp_ResponseCode'),
    transactionStatus: readString(rawPayload, 'vnp_TransactionStatus'),
    transactionNo: readString(rawPayload, 'vnp_TransactionNo'),
    bankCode: readString(rawPayload, 'vnp_BankCode'),
    amount: callbackAmount,
    orderAmount,
    amountVerified: callbackAmount === orderAmount,
    rawPayload,
    signature: audit.signature || '',
    checksumValid: audit.valid,
  };
}

async function backfillOrder(prisma: PrismaClientType, order: NonNullable<Awaited<ReturnType<PrismaClientType['order']['findFirst']>>> & {
  audits: Array<{
    kind: string;
    payload: unknown;
    signature: string | null;
    valid: boolean;
    createdAt: Date;
  }>;
}): Promise<'created' | 'skipped'> {
  const existingEvents = await prisma.orderEvent.count({ where: { orderId: order.id } });
  if (existingEvents > 0) return 'skipped';

  await prisma.$transaction(async (tx) => {
    let version = 1;
    const createAudit = order.audits.find((audit) => audit.kind === 'CREATE_URL');

    async function addEvent(eventType: string, payload: Record<string, unknown>, occurredAt: Date): Promise<void> {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType,
          version,
          payload,
          metadata: { source: 'backfill-order-events', traceId: order.traceId || '' },
          occurredAt,
        },
      });
      version += 1;
    }

    await addEvent(
      'ORDER_CREATED',
      {
        orderId: order.id,
        userId: order.userId,
        courseId: order.courseId,
        instructorId: order.instructorId,
        courseTitle: order.courseTitle,
        amount: order.amount.toNumber(),
        currency: order.currency,
        vnpTxnRef: order.vnpTxnRef,
        traceId: order.traceId,
      },
      order.createdAt,
    );

    await addEvent(
      'PAYMENT_URL_GENERATED',
      {
        orderId: order.id,
        payUrl: order.vnpPayUrl,
        expiresAt: order.expiresAt?.toISOString() ?? null,
        vnpParams: createAudit ? asObject(createAudit.payload) : {},
        signature: createAudit?.signature || '',
      },
      createAudit?.createdAt ?? order.createdAt,
    );

    for (const audit of order.audits.filter((item) => item.kind === 'RETURN' || item.kind === 'IPN')) {
      await addEvent('VNPAY_CALLBACK_RECEIVED', callbackPayload(order, audit), audit.createdAt);
    }

    if (order.status === 'COMPLETED') {
      if (order.vnpTransactionNo || order.vnpBankCode) {
        await addEvent(
          'PAYMENT_VERIFIED',
          {
            orderId: order.id,
            vnpTransactionNo: order.vnpTransactionNo,
            vnpBankCode: order.vnpBankCode,
            vnpResponseCode: order.vnpResponseCode,
            amountVerified: true,
          },
          order.paidAt ?? order.updatedAt,
        );
      }

      await addEvent(
        'ORDER_COMPLETED',
        {
          orderId: order.id,
          paidAt: (order.paidAt ?? order.updatedAt).toISOString(),
          enrollmentEventPublished: false,
          outboxEnqueued: true,
        },
        order.paidAt ?? order.updatedAt,
      );
    }

    if (order.status === 'FAILED') {
      await addEvent(
        'ORDER_FAILED',
        {
          orderId: order.id,
          reason: order.failureReason || `code=${order.vnpResponseCode || 'unknown'}`,
          responseCode: order.vnpResponseCode || '',
        },
        order.updatedAt,
      );
    }

    if (order.status === 'EXPIRED') {
      await addEvent(
        'ORDER_EXPIRED',
        {
          orderId: order.id,
          expiredAt: (order.expiresAt ?? order.updatedAt).toISOString(),
        },
        order.expiresAt ?? order.updatedAt,
      );
    }

    if (order.status === 'REFUNDED') {
      await addEvent(
        'ORDER_REFUNDED',
        {
          orderId: order.id,
          refundAmount: order.amount.toNumber(),
          refundReason: order.failureReason || 'Backfilled refunded order',
          refundedBy: 'system-backfill',
        },
        order.updatedAt,
      );
    }
  });

  return 'created';
}

async function main(): Promise<void> {
  loadEnvFile();

  const { PrismaClient } = await import('../src/generated/prisma/index.js');
  const prisma = new PrismaClient();

  try {
    const orders = await prisma.order.findMany({
      include: { audits: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    let created = 0;
    let skipped = 0;

    for (const order of orders) {
      const result = await backfillOrder(prisma, order);
      if (result === 'created') created += 1;
      if (result === 'skipped') skipped += 1;
    }

    console.log(`[backfill-order-events] orders=${orders.length} created=${created} skipped=${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[backfill-order-events] failed', err);
  process.exit(1);
});
