import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  TOPICS,
  PAYMENT_ORDER_COMPLETED_RETRY,
  type KafkaEventEnvelope,
  type PaymentOrderCompletedEvent,
  type KafkaTopic,
  validateKafkaEvent,
  PaymentOrderCompletedSchema,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from './prisma.js';
import { enqueueEnrollmentCreatedOutbox } from './outbox.js';
import { Prisma } from '../generated/prisma/index.js';

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

export type PaymentOrderCompletedHandlingResult =
  | 'ENROLLMENT_CREATED'
  | 'ENROLLMENT_ALREADY_EXISTS';

export class InvalidPaymentOrderCompletedEventError extends Error {
  constructor() {
    super('Invalid payment.order.completed payload');
    this.name = 'InvalidPaymentOrderCompletedEventError';
  }
}

async function findExistingEnrollment(orderId: string, userId: string, courseId: string) {
  return prisma.enrollment.findFirst({
    where: {
      OR: [
        { orderId },
        { userId, courseId },
      ],
    },
  });
}

export async function handlePaymentOrderCompletedEvent(
  event: Pick<KafkaEventEnvelope<PaymentOrderCompletedEvent>, 'data' | 'trace_id'>,
): Promise<PaymentOrderCompletedHandlingResult> {
  const validated = validateKafkaEvent(
    PaymentOrderCompletedSchema,
    event.data,
    'payment.order.completed',
    logger,
  );
  if (!validated) throw new InvalidPaymentOrderCompletedEventError();

  const { order_id, user_id, course_id, paid_at } = validated;
  logger.info(
    { orderId: order_id, userId: user_id, courseId: course_id, traceId: event.trace_id },
    '[learning-service] Consuming payment.order.completed',
  );

  const existing = await findExistingEnrollment(order_id, user_id, course_id);
  if (existing) {
    logger.info(
      { enrollmentId: existing.id, orderId: order_id, userId: user_id, courseId: course_id },
      'Enrollment already exists',
    );
    return 'ENROLLMENT_ALREADY_EXISTS';
  }

  try {
    const { enrollment, outbox } = await prisma.$transaction(async (tx) => {
      const created = await tx.enrollment.create({
        data: {
          userId: user_id,
          courseId: course_id,
          orderId: order_id,
          enrolledAt: paid_at ? new Date(paid_at) : new Date(),
        },
      });

      // Enrollment paid va downstream event di cung transaction de tranh mat event.
      const outbox = await enqueueEnrollmentCreatedOutbox(
        tx,
        {
          user_id,
          course_id,
          order_id,
          enrolled_at: created.enrolledAt.toISOString(),
        },
        event.trace_id,
      );

      return { enrollment: created, outbox };
    });

    if (outbox.created) {
      logger.info(
        { event: 'outbox.created', outboxId: outbox.id, topic: 'learning.enrollment.created', orderId: order_id },
        'outbox.created',
      );
    }
    logger.info(
      { enrollmentId: enrollment.id, orderId: order_id, userId: user_id, courseId: course_id },
      'Enrollment created',
    );
    return 'ENROLLMENT_CREATED';
  } catch (err) {
    // Consumer co the nhan cung event song song; unique constraint la lop idempotency cuoi.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existingAfterRace = await findExistingEnrollment(order_id, user_id, course_id);
      if (existingAfterRace) {
        logger.info(
          { enrollmentId: existingAfterRace.id, orderId: order_id, userId: user_id, courseId: course_id },
          'Enrollment already exists',
        );
        return 'ENROLLMENT_ALREADY_EXISTS';
      }
    }
    throw err;
  }
}

export async function startKafkaConsumers(): Promise<void> {
  const producer = await createProducer();

  // Subscribe main + retry topics
  const topics: KafkaTopic[] = [
    TOPICS.PAYMENT_ORDER_COMPLETED,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_5S,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_30S,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_1M,
  ];

  await Promise.all(
    topics.map(async (topic) => {
      const consumer = await createConsumer(`${HANDLER_GROUP}.${topic}`);
      await consumeWithRetry<PaymentOrderCompletedEvent>(consumer, producer, {
        topic,
        groupId: `${HANDLER_GROUP}.${topic}`,
        retry: PAYMENT_ORDER_COMPLETED_RETRY,
        handler: async (event) => {
          await handlePaymentOrderCompletedEvent(event);
        },
        onError: (err) => logger.error({ err, topic }, '[learning-service] Consumer handler failed'),
      });
      logger.info({ topic }, '[learning-service] Kafka consumer running');
    }),
  );
}
