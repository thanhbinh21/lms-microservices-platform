import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  TOPICS,
  PAYMENT_ORDER_COMPLETED_RETRY,
  type PaymentOrderCompletedEvent,
  type KafkaTopic,
  validateKafkaEvent,
  PaymentOrderCompletedSchema,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from './prisma.js';
import { enqueueEnrollmentCreatedOutbox } from './outbox.js';

/**
 * Learning-service Kafka consumers (Phase 2 refactor).
 *
 * Flow:
 *   payment.order.completed → tao Enrollment (idempotent by orderId)
 *                           → publish enrollment.created
 *   enrollment.created → notification-service (email)
 *                      → course-service (increment enrollmentCount)
 */

const HANDLER_GROUP = 'learning-service.enrollment-creator';

export async function startKafkaConsumers(): Promise<void> {
  const producer = await createProducer();

  // Handler tao enrollment khi payment hoan tat
  const handler = async (event: { data: PaymentOrderCompletedEvent; trace_id: string }) => {
    const validated = validateKafkaEvent(
      PaymentOrderCompletedSchema,
      event.data,
      'payment.order.completed',
      logger,
    );
    if (!validated) throw new Error('Invalid payment.order.completed payload');

    const { order_id, user_id, course_id, paid_at } = validated;

    logger.info(
      { orderId: order_id, userId: user_id, courseId: course_id, traceId: event.trace_id },
      '[learning-service] Consuming payment.order.completed',
    );

    // Idempotent: Enrollment.orderId la unique constraint
    const existing = await prisma.enrollment.findUnique({ where: { orderId: order_id } });
    if (existing) {
      logger.info({ orderId: order_id }, '[learning-service] Enrollment already exists — skip');
      return;
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      const created = await tx.enrollment.create({
        data: {
          userId: user_id,
          courseId: course_id,
          orderId: order_id,
          enrolledAt: paid_at ? new Date(paid_at) : new Date(),
        },
      });

      // Enrollment paid va downstream event di cung transaction de tranh mat event.
      await enqueueEnrollmentCreatedOutbox(
        tx,
        {
          user_id,
          course_id,
          order_id,
          enrolled_at: created.enrolledAt.toISOString(),
        },
        event.trace_id,
      );

      return created;
    });

    logger.info(
      { enrollmentId: enrollment.id, orderId: order_id, userId: user_id, courseId: course_id },
      '[learning-service] Enrollment created',
    );
  };

  // Subscribe main + retry topics
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
        onError: (err) => logger.error({ err, topic }, '[learning-service] Consumer handler failed'),
      });
      logger.info({ topic }, '[learning-service] Kafka consumer running');
    }),
  );
}
