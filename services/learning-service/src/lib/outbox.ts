import {
  createProducer,
  publishEvent,
  TOPICS,
  type EnrollmentCreatedEvent,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from './prisma.js';
import type { Prisma } from '../generated/prisma/index.js';

const MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS || 10);
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 5_000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 20);

type LearningOutboxTx = Pick<typeof prisma, 'outboxEvent'>;

let outboxTimer: NodeJS.Timeout | null = null;
let isPublishing = false;
let producerPromise: ReturnType<typeof createProducer> | null = null;

function getProducer() {
  if (!producerPromise) {
    producerPromise = createProducer();
  }
  return producerPromise;
}

export async function enqueueEnrollmentCreatedOutbox(
  tx: LearningOutboxTx,
  data: EnrollmentCreatedEvent,
  traceId?: string,
): Promise<void> {
  await tx.outboxEvent.upsert({
    where: { dedupeKey: `learning.enrollment.created:${data.order_id}` },
    create: {
      topic: TOPICS.ENROLLMENT_CREATED,
      eventKey: data.user_id,
      dedupeKey: `learning.enrollment.created:${data.order_id}`,
      payload: data as unknown as Prisma.InputJsonValue,
      traceId,
    },
    update: {},
  });
}

function getNextAttemptAt(retryCount: number): Date {
  const delayMs = Math.min(60_000, 5_000 * Math.max(1, 2 ** retryCount));
  return new Date(Date.now() + delayMs);
}

async function publishOutboxBatch(): Promise<void> {
  if (isPublishing) return;
  isPublishing = true;

  try {
    const events = await prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (events.length === 0) return;

    const producer = await getProducer();
    for (const event of events) {
      const claimed = await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: 'PENDING' },
        data: { status: 'PROCESSING' },
      });

      if (claimed.count !== 1) continue;

      try {
        if (event.topic !== TOPICS.ENROLLMENT_CREATED) {
          throw new Error(`Unsupported learning outbox topic: ${event.topic}`);
        }

        await publishEvent(
          producer,
          TOPICS.ENROLLMENT_CREATED,
          event.payload as unknown as EnrollmentCreatedEvent,
          {
            traceId: event.traceId || undefined,
            key: event.eventKey || undefined,
            eventId: event.id,
          },
        );

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            lastError: null,
          },
        });
      } catch (err) {
        const nextRetryCount = event.retryCount + 1;
        const failedPermanently = nextRetryCount >= MAX_ATTEMPTS;
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: failedPermanently ? 'FAILED' : 'PENDING',
            retryCount: nextRetryCount,
            nextAttemptAt: getNextAttemptAt(nextRetryCount),
            lastError: err instanceof Error ? err.message : String(err),
          },
        });
        logger.error({ err, outboxId: event.id, topic: event.topic }, 'Learning outbox publish failed');
      }
    }
  } finally {
    isPublishing = false;
  }
}

export function startLearningOutboxWorker(): void {
  if (outboxTimer) return;

  void prisma.outboxEvent.updateMany({
    where: { status: 'PROCESSING' },
    data: { status: 'PENDING' },
  });

  outboxTimer = setInterval(() => {
    publishOutboxBatch().catch((err) => logger.error({ err }, 'Learning outbox worker tick failed'));
  }, POLL_INTERVAL_MS);

  publishOutboxBatch().catch((err) => logger.error({ err }, 'Learning outbox initial publish failed'));
  logger.info({ intervalMs: POLL_INTERVAL_MS }, 'Learning outbox worker started');
}

export async function stopLearningOutboxWorker(): Promise<void> {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
  if (producerPromise) {
    const producer = await producerPromise;
    await producer.disconnect();
    producerPromise = null;
  }
}
