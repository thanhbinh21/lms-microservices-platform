import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  TOPICS,
  ENROLLMENT_CREATED_RETRY,
  type EnrollmentCreatedEvent,
  type KafkaTopic,
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

  const topics: KafkaTopic[] = [
    TOPICS.ENROLLMENT_CREATED,
    TOPICS.ENROLLMENT_CREATED_RETRY_5S,
    TOPICS.ENROLLMENT_CREATED_RETRY_1M,
  ];

  await Promise.all(
    topics.map(async (topic) => {
      const consumer = await createConsumer(`${HANDLER_GROUP}.${topic}`);
      await consumeWithRetry<EnrollmentCreatedEvent>(consumer, producer, {
        topic,
        groupId: `${HANDLER_GROUP}.${topic}`,
        retry: ENROLLMENT_CREATED_RETRY,
        handler: async (event) => {
      const validated = validateKafkaEvent(
        EnrollmentCreatedSchema,
        event.data,
        'learning.enrollment.created',
        logger,
      );
      if (!validated) throw new Error('Invalid learning.enrollment.created payload');

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
        onError: (err) => logger.error({ err, topic }, '[course-service] Enrollment signal consumer failed'),
      });
      logger.info({ topic }, '[course-service] Enrollment signal consumer running');
    }),
  );
}
