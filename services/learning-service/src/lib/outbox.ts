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

function logProducerReconnectScheduled(reason: 'connect_failed' | 'publish_failed', err: unknown): void {
  logger.warn(
    { err, event: 'kafka.producer.reconnect_scheduled', reason },
    'Learning outbox Kafka producer reconnect scheduled',
  );
}

function resetProducerAfterPublishFailure(err: unknown): void {
  const pendingProducer = producerPromise;
  producerPromise = null;
  logProducerReconnectScheduled('publish_failed', err);

  if (pendingProducer) {
    void pendingProducer
      .then((producer) => producer.disconnect())
      .catch(() => undefined);
  }
}

function getProducer() {
  if (!producerPromise) {
    producerPromise = createProducer().catch((err) => {
      // Cho phep tick sau ket noi lai khi Kafka tam thoi unavailable.
      producerPromise = null;
      logProducerReconnectScheduled('connect_failed', err);
      throw err;
    });
  }
  return producerPromise;
}

export async function enqueueEnrollmentCreatedOutbox(
  tx: LearningOutboxTx,
  data: EnrollmentCreatedEvent,
  traceId?: string,
): Promise<{ id: string; created: boolean }> {
  const dedupeKey = `learning.enrollment.created:${data.order_id}`;
  const existing = await tx.outboxEvent.findUnique({
    where: { dedupeKey },
    select: { id: true },
  });
  if (existing) {
    return { id: existing.id, created: false };
  }

  const outbox = await tx.outboxEvent.upsert({
    where: { dedupeKey },
    create: {
      topic: TOPICS.ENROLLMENT_CREATED,
      eventKey: data.user_id,
      dedupeKey,
      payload: data as unknown as Prisma.InputJsonValue,
      traceId,
    },
    update: {},
    select: { id: true },
  });
  return { id: outbox.id, created: true };
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
        // FAILED van duoc thu lai voi backoff de broker outage dai khong can restart service.
        status: { in: ['PENDING', 'FAILED'] },
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (events.length === 0) return;

    const producer = await getProducer();
    for (const event of events) {
      const claimed = await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: event.status },
        data: { status: 'PROCESSING' },
      });

      if (claimed.count !== 1) continue;

      let publishAttempted = false;
      try {
        if (event.topic !== TOPICS.ENROLLMENT_CREATED) {
          throw new Error(`Unsupported learning outbox topic: ${event.topic}`);
        }

        publishAttempted = true;
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
        logger.info({ event: 'outbox.published', outboxId: event.id, topic: event.topic }, 'Learning outbox event published');
      } catch (err) {
        if (publishAttempted) {
          resetProducerAfterPublishFailure(err);
        }
        const nextRetryCount = event.retryCount + 1;
        const retryLimitReached = nextRetryCount >= MAX_ATTEMPTS;
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: retryLimitReached ? 'FAILED' : 'PENDING',
            retryCount: nextRetryCount,
            nextAttemptAt: getNextAttemptAt(nextRetryCount),
            lastError: err instanceof Error ? err.message : String(err),
          },
        });
        logger.error({ err, event: 'outbox.publish_failed', outboxId: event.id, topic: event.topic }, 'Learning outbox publish failed');
        if (publishAttempted) return;
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
    publishOutboxBatch().catch((err) =>
      logger.error({ err, event: 'outbox.worker_tick_failed' }, 'Learning outbox worker tick failed'),
    );
  }, POLL_INTERVAL_MS);

  publishOutboxBatch().catch((err) =>
    logger.error({ err, event: 'outbox.worker_tick_failed' }, 'Learning outbox initial publish failed'),
  );
  logger.info({ intervalMs: POLL_INTERVAL_MS }, 'Learning outbox worker started');
}

export async function stopLearningOutboxWorker(): Promise<void> {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
  if (producerPromise) {
    const pendingProducer = producerPromise;
    producerPromise = null;
    try {
      const producer = await pendingProducer;
      await producer.disconnect();
    } catch {
      // Producer co the dang fail connect khi service shutdown.
    }
  }
}
