import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient as LearningPrisma } from '../services/learning-service/src/generated/prisma/index.js';

const DEMO_EVENT_COUNT = 8;
const DEMO_TOPIC = 'payment.order.completed';
const BASE_EVENT_ID = 'demo-dlq-payment-order-completed';
const DEFAULT_ORDER_ID = '11111111-1111-4111-8111-111111111111';

const FAILURE_MESSAGE = 'Learning service temporarily unavailable';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function readEnvVarFromFile(filePath: string, variableName: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const equalIndex = normalized.indexOf('=');
    if (equalIndex === -1 || normalized.slice(0, equalIndex).trim() !== variableName) continue;
    let value = normalized.slice(equalIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

function withSeedConnectionParams(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '30');
    return url.toString();
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}connection_limit=1&pool_timeout=30`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createFallbackPayload(timestamp: string): Record<string, unknown> {
  return {
    event_id: BASE_EVENT_ID,
    event_type: DEMO_TOPIC,
    timestamp,
    trace_id: 'trace-demo-dlq',
    data: {
      order_id: DEFAULT_ORDER_ID,
      user_id: 'demo-dlq-student',
      course_id: '22222222-2222-4222-8222-222222222222',
      instructor_id: 'demo-dlq-instructor',
      amount: 799000,
      currency: 'VND',
      payment_method: 'vnpay',
      vnp_txn_ref: 'DEMO-DLQ-ORDER',
      vnp_transaction_no: 'TRDLQ000001',
      paid_at: timestamp,
      instructor_share_ratio: 0.7,
      platform_fee_ratio: 0.3,
    },
  };
}

async function main(): Promise<void> {
  const learningEnvFile = path.join(projectRoot, 'services', 'learning-service', '.env');
  const databaseUrl = withSeedConnectionParams(
    process.env.DATABASE_URL_LEARNING
      || readEnvVarFromFile(learningEnvFile, 'DIRECT_URL')
      || readEnvVarFromFile(learningEnvFile, 'DATABASE_URL'),
  );
  if (!databaseUrl) {
    throw new Error('Missing learning-service DATABASE_URL or DIRECT_URL.');
  }

  const prisma = new LearningPrisma({ datasources: { db: { url: databaseUrl } } });
  try {
    const now = new Date();
    const templateEvent = await prisma.failedEvent.findFirst({
      where: {
        topic: DEMO_TOPIC,
        eventId: { startsWith: BASE_EVENT_ID },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true, originalKey: true },
    });
    const fallbackPayload = createFallbackPayload(now.toISOString());
    const templatePayload = isRecord(templateEvent?.payload) ? templateEvent.payload : fallbackPayload;
    const templateData = isRecord(templatePayload.data)
      ? templatePayload.data
      : fallbackPayload.data as Record<string, unknown>;
    const originalKey = templateEvent?.originalKey
      || (typeof templateData.order_id === 'string' ? templateData.order_id : DEFAULT_ORDER_ID);

    // Chi reset du lieu cua order demo de lan retry dau tien luon minh hoa nhanh tao enrollment.
    await prisma.$transaction([
      prisma.outboxEvent.deleteMany({
        where: { dedupeKey: `learning.enrollment.created:${DEFAULT_ORDER_ID}` },
      }),
      prisma.enrollment.deleteMany({
        where: { orderId: DEFAULT_ORDER_ID },
      }),
    ]);

    const rows = [];
    for (let index = 0; index < DEMO_EVENT_COUNT; index += 1) {
      const eventId = index === 0 ? BASE_EVENT_ID : `${BASE_EVENT_ID}-${String(index + 1).padStart(2, '0')}`;
      const traceId = `trace-demo-dlq-${String(index + 1).padStart(2, '0')}`;
      const createdAt = new Date(now.getTime() - index * 60_000);
      const payload = {
        ...templatePayload,
        event_id: eventId,
        event_type: DEMO_TOPIC,
        timestamp: createdAt.toISOString(),
        trace_id: traceId,
        data: templateData,
      };

      const row = await prisma.failedEvent.upsert({
        where: { topic_eventId: { topic: DEMO_TOPIC, eventId } },
        create: {
          topic: DEMO_TOPIC,
          eventId,
          traceId,
          originalKey,
          payload,
          errorMessage: FAILURE_MESSAGE,
          retryCount: 3,
          status: 'PENDING',
          createdAt,
        },
        update: {
          traceId,
          originalKey,
          payload,
          errorMessage: FAILURE_MESSAGE,
          retryCount: 3,
          status: 'PENDING',
          retriedAt: null,
          createdAt,
        },
        select: {
          id: true,
          topic: true,
          eventId: true,
          retryCount: true,
          status: true,
          errorMessage: true,
        },
      });
      rows.push(row);
    }

    console.log(`Seeded ${rows.length} DLQ demo events into learning_db.`);
    console.table(rows);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('DLQ demo seed failed:', error);
  process.exit(1);
});
