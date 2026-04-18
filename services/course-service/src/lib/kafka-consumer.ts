import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  TOPICS,
  PAYMENT_ORDER_COMPLETED_RETRY,
  publishEvent,
  type PaymentOrderCompletedEvent,
  type KafkaTopic,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from './prisma';

/**
 * Course-service Kafka consumers (Phase 16).
 *
 * Chu y:
 *  - `payment.order.completed` la main topic -> enrollment phai idempotent theo order_id.
 *  - Retry 5s -> 1m -> DLQ (pattern consumeWithRetry cua @lms/kafka-client).
 *  - Moi retry topic co consumer rieng nhung chay chung handler.
 */

const HANDLER_GROUP = 'course-service.enrollment-creator';

export async function startKafkaConsumers(): Promise<void> {
  const producer = await createProducer();

  // Handler chung cho ca main + retry topics.
  const handler = async (event: { data: PaymentOrderCompletedEvent; trace_id: string }) => {
    const { order_id, user_id, course_id, paid_at } = event.data;

    logger.info(
      { orderId: order_id, userId: user_id, courseId: course_id, traceId: event.trace_id },
      'Consuming payment.order.completed',
    );

    // Idempotent: Enrollment.orderId la unique; upsert de lan tiep theo khong fail.
    const existing = await prisma.enrollment.findUnique({ where: { orderId: order_id } });

    if (existing) {
      logger.info({ orderId: order_id }, 'Enrollment already exists — skip (idempotent)');
      return;
    }

    await prisma.$transaction([
      prisma.enrollment.create({
        data: {
          userId: user_id,
          courseId: course_id,
          orderId: order_id,
          enrolledAt: paid_at ? new Date(paid_at) : new Date(),
        },
      }),
      prisma.course.update({
        where: { id: course_id },
        data: { enrollmentCount: { increment: 1 } },
      }),
    ]);

    logger.info({ orderId: order_id, userId: user_id, courseId: course_id }, 'Enrollment created');

    // Downstream: phat event enrollment.created de notification-service consume.
    try {
      await publishEvent(
        producer,
        TOPICS.ENROLLMENT_CREATED,
        {
          user_id,
          course_id,
          order_id,
          enrolled_at: new Date().toISOString(),
        },
        { traceId: event.trace_id, key: user_id },
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to publish enrollment.created — non-fatal');
    }
  };

  // Subscribe main + retry topics voi group id khac nhau (kafkajs require 1 consumer/group/topic).
  // Ta tao nhieu consumer instance dung chung producer.
  const topics: KafkaTopic[] = [
    TOPICS.PAYMENT_ORDER_COMPLETED,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_5S,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_1M,
  ];

  await Promise.all(
    topics.map(async (topic) => {
      const consumer = await createConsumer(`${HANDLER_GROUP}.${topic}`);
      await consumeWithRetry<PaymentOrderCompletedEvent>(consumer, producer, {
        topic,
        groupId: `${HANDLER_GROUP}.${topic}`,
        retry: PAYMENT_ORDER_COMPLETED_RETRY,
        handler: async (event) => handler(event),
        onError: (err) => logger.error({ err, topic }, 'Consumer handler failed'),
      });
      logger.info({ topic }, 'Kafka consumer running');
    }),
  );
}
