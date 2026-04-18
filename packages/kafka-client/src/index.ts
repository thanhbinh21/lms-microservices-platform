import { Kafka, Producer, Consumer, Partitioners, EachMessagePayload } from 'kafkajs';
import { randomUUID } from 'crypto';

// ─── Kafka client (shared) ────────────────────────────────────────────────────

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'lms-platform',
  brokers: (process.env.KAFKA_BROKER || 'localhost:9092').split(',').map((b) => b.trim()),
});

export const createProducer = async (): Promise<Producer> => {
  const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
    allowAutoTopicCreation: true,
    idempotent: false,
  });
  await producer.connect();
  return producer;
};

export const createConsumer = async (groupId: string): Promise<Consumer> => {
  const consumer = kafka.consumer({
    groupId,
    allowAutoTopicCreation: true,
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
  });
  await consumer.connect();
  return consumer;
};

// ─── Topics ───────────────────────────────────────────────────────────────────
// Theo project_structure.md — Phase 15/16: payment + retry + DLQ.
// Giu lai cac topic learning.* legacy de backward-compatible.

export const TOPICS = {
  // Payment flow (Phase 15)
  PAYMENT_ORDER_COMPLETED: 'payment.order.completed',
  PAYMENT_ORDER_COMPLETED_RETRY_5S: 'payment.order.completed.retry-5s',
  PAYMENT_ORDER_COMPLETED_RETRY_1M: 'payment.order.completed.retry-1m',

  // Enrollment flow (Phase 16)
  ENROLLMENT_CREATED: 'learning.enrollment.created',

  // Legacy / future
  LESSON_COMPLETED: 'learning.lesson.completed',
  COURSE_COMPLETED: 'learning.course.completed',

  // Dead letter (Phase 15)
  DEAD_LETTER: 'system.dead-letter',
} as const;

export type KafkaTopic = (typeof TOPICS)[keyof typeof TOPICS];

// ─── Typed Events ─────────────────────────────────────────────────────────────

export interface KafkaEventEnvelope<T> {
  event_id: string;
  event_type: string;
  timestamp: string;
  trace_id: string;
  data: T;
}

export interface PaymentOrderCompletedEvent {
  order_id: string;
  user_id: string;
  course_id: string;
  amount: number;
  currency: string;
  payment_method: 'vnpay';
  vnp_txn_ref: string;
  vnp_transaction_no: string;
  paid_at: string;
}

export interface EnrollmentCreatedEvent {
  user_id: string;
  course_id: string;
  order_id: string;
  enrolled_at: string;
}

// Ban do type theo topic de ep kieu khi publish/consume.
export interface TopicEventMap {
  [TOPICS.PAYMENT_ORDER_COMPLETED]: PaymentOrderCompletedEvent;
  [TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_5S]: PaymentOrderCompletedEvent;
  [TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_1M]: PaymentOrderCompletedEvent;
  [TOPICS.ENROLLMENT_CREATED]: EnrollmentCreatedEvent;
  [TOPICS.DEAD_LETTER]: unknown;
  [TOPICS.LESSON_COMPLETED]: unknown;
  [TOPICS.COURSE_COMPLETED]: unknown;
}

// ─── Publish helper ───────────────────────────────────────────────────────────

/**
 * Publish typed event voi envelope chuan (event_id, timestamp, trace_id).
 * Key message = entity id (order_id / user_id) de giu thu tu theo partition.
 */
export async function publishEvent<T extends KafkaTopic>(
  producer: Producer,
  topic: T,
  data: TopicEventMap[T],
  options: { traceId?: string; key?: string; headers?: Record<string, string> } = {},
): Promise<void> {
  const envelope: KafkaEventEnvelope<TopicEventMap[T]> = {
    event_id: randomUUID(),
    event_type: topic,
    timestamp: new Date().toISOString(),
    trace_id: options.traceId || randomUUID(),
    data,
  };

  await producer.send({
    topic,
    messages: [
      {
        key: options.key ?? null,
        value: JSON.stringify(envelope),
        headers: {
          'x-trace-id': envelope.trace_id,
          'x-event-id': envelope.event_id,
          'x-event-type': topic,
          ...(options.headers || {}),
        },
      },
    ],
  });
}

// ─── Retry + DLQ consumer wrapper ─────────────────────────────────────────────
//
// Kafka khong co native delayed queue. Pattern chuan:
//   main topic -> (fail) -> retry-5s topic (delay 5s truoc khi process lai)
//                        -> retry-1m topic (delay 60s)
//                        -> dead-letter topic
// Moi topic retry co consumer rieng dung chung handler nhung delay truoc khi chay.

export interface RetryPolicy {
  /** Topic goc chinh (source of truth). */
  mainTopic: KafkaTopic;
  /** Chuoi retry xep tu nhanh -> cham. Moi phan tu la [topic, delayMs]. */
  retryChain: Array<{ topic: KafkaTopic; delayMs: number }>;
  /** Topic cuoi khi het retry. */
  deadLetterTopic: KafkaTopic;
}

export interface ConsumeOptions<T> {
  /** Topic hien tai subscribe (main hoac mot retry topic). */
  topic: KafkaTopic;
  groupId: string;
  /** Handler xu ly event. Throw de kich hoat retry. */
  handler: (event: KafkaEventEnvelope<T>, raw: EachMessagePayload) => Promise<void>;
  /** Chinh sach retry. Neu bo qua, fail = throw ra khong retry. */
  retry?: RetryPolicy;
  /** Log callback (optional). */
  onError?: (err: unknown, raw: EachMessagePayload) => void;
}

function getNumberHeader(payload: EachMessagePayload, key: string): number {
  const raw = payload.message.headers?.[key];
  if (!raw) return 0;
  const s = Buffer.isBuffer(raw) ? raw.toString('utf-8') : String(raw);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Subscribe mot topic va xu ly retry theo RetryPolicy.
 * Khi handler throw:
 *  - Neu con topic retry ke tiep -> sleep delay + republish sang topic do.
 *  - Neu het -> publish sang dead-letter topic.
 */
export async function consumeWithRetry<T = unknown>(
  consumer: Consumer,
  producer: Producer,
  options: ConsumeOptions<T>,
): Promise<void> {
  const { topic, handler, retry, onError } = options;

  await consumer.subscribe({ topic, fromBeginning: false });

  await consumer.run({
    autoCommit: true,
    eachMessage: async (payload: EachMessagePayload) => {
      const value = payload.message.value?.toString('utf-8') || '{}';
      let envelope: KafkaEventEnvelope<T>;
      try {
        envelope = JSON.parse(value) as KafkaEventEnvelope<T>;
      } catch {
        // Message rac -> day thang sang DLQ neu co.
        if (retry) {
          await producer.send({
            topic: retry.deadLetterTopic,
            messages: [
              {
                key: payload.message.key,
                value,
                headers: {
                  'x-original-topic': topic,
                  'x-failure-reason': 'invalid-json',
                },
              },
            ],
          });
        }
        return;
      }

      try {
        await handler(envelope, payload);
      } catch (err) {
        onError?.(err, payload);

        if (!retry) {
          // Khong co chinh sach retry -> re-throw de consumer Kafka retry mac dinh.
          throw err;
        }

        const retryCount = getNumberHeader(payload, 'x-retry-count');
        const nextStep = retry.retryChain[retryCount];

        if (!nextStep) {
          // Het retry -> DLQ.
          await producer.send({
            topic: retry.deadLetterTopic,
            messages: [
              {
                key: payload.message.key,
                value,
                headers: {
                  'x-original-topic': retry.mainTopic,
                  'x-retry-count': String(retryCount),
                  'x-trace-id': envelope.trace_id,
                  'x-failure-reason': err instanceof Error ? err.message : String(err),
                },
              },
            ],
          });
          return;
        }

        // Delay truoc khi republish (Kafka khong ho tro delayed queue native).
        await sleep(nextStep.delayMs);

        await producer.send({
          topic: nextStep.topic,
          messages: [
            {
              key: payload.message.key,
              value,
              headers: {
                'x-retry-count': String(retryCount + 1),
                'x-original-topic': retry.mainTopic,
                'x-trace-id': envelope.trace_id,
                'x-failure-reason': err instanceof Error ? err.message : String(err),
              },
            },
          ],
        });
      }
    },
  });
}

// ─── Default retry policy cho payment.order.completed ─────────────────────────

export const PAYMENT_ORDER_COMPLETED_RETRY: RetryPolicy = {
  mainTopic: TOPICS.PAYMENT_ORDER_COMPLETED,
  retryChain: [
    { topic: TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_5S, delayMs: 5_000 },
    { topic: TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_1M, delayMs: 60_000 },
  ],
  deadLetterTopic: TOPICS.DEAD_LETTER,
};

export { kafka };
export default kafka;
