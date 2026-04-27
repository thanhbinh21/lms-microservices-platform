import {
  createProducer,
  publishEvent as publishTypedEvent,
  TOPICS,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';

type Producer = Awaited<ReturnType<typeof createProducer>>;

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = await createProducer();
    logger.info('Kafka producer connected (course-service)');
  }
  return producer;
}

export async function publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const p = await getProducer();
    await p.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    logger.info({ topic, payload }, 'Kafka event published');
  } catch (err) {
    logger.warn({ err, topic }, 'Failed to publish Kafka event — continuing without rollback');
    throw err;
  }
}

export async function publishEnrollmentCreatedEvent(
  payload: {
    userId: string;
    courseId: string;
    orderId: string;
    enrolledAt: Date | string;
  },
  traceId = '',
): Promise<void> {
  try {
    const p = await getProducer();
    await publishTypedEvent(
      p,
      TOPICS.ENROLLMENT_CREATED,
      {
        user_id: payload.userId,
        course_id: payload.courseId,
        order_id: payload.orderId,
        enrolled_at:
          payload.enrolledAt instanceof Date
            ? payload.enrolledAt.toISOString()
            : payload.enrolledAt,
      },
      {
        traceId,
        key: payload.userId,
      },
    );
  } catch (err) {
    logger.warn(
      { err, userId: payload.userId, courseId: payload.courseId },
      'Failed to publish learning.enrollment.created',
    );
    throw err;
  }
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
