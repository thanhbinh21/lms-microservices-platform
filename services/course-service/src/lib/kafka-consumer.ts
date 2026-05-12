import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  TOPICS,
  type EnrollmentCreatedEvent,
  validateKafkaEvent,
  EnrollmentCreatedSchema,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from './prisma';

/**
 * Course-service Kafka consumers (Phase 4 cleanup).
 *
 * Flow:
 *  - `learning.enrollment.created` -> tang enrollmentCount (idempotent theo order_id)
 */

const HANDLER_GROUP = 'course-service.enrollment-count';

export async function startKafkaConsumers(): Promise<void> {
  const producer = await createProducer();

  const consumer = await createConsumer(HANDLER_GROUP);
  await consumeWithRetry<EnrollmentCreatedEvent>(consumer, producer, {
    topic: TOPICS.ENROLLMENT_CREATED,
    groupId: HANDLER_GROUP,
    handler: async (event) => {
      const validated = validateKafkaEvent(
        EnrollmentCreatedSchema,
        event.data,
        'learning.enrollment.created',
        logger,
      );
      if (!validated) return;

      const { order_id, user_id, course_id } = validated;

      logger.info(
        { orderId: order_id, userId: user_id, courseId: course_id, traceId: event.trace_id },
        '[course-service] Consuming learning.enrollment.created',
      );

      try {
        await prisma.$transaction([
          prisma.enrollmentSignal.create({
            data: {
              orderId: order_id,
              userId: user_id,
              courseId: course_id,
            },
          }),
          prisma.course.update({
            where: { id: course_id },
            data: { enrollmentCount: { increment: 1 } },
          }),
        ]);
      } catch (err: any) {
        if (err?.code === 'P2002') {
          logger.info({ orderId: order_id }, '[course-service] Enrollment signal already applied — skip');
          return;
        }
        throw err;
      }
    },
    onError: (err) => logger.error({ err }, '[course-service] Enrollment signal consumer failed'),
  });
}
