import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  PAYMENT_ORDER_COMPLETED_RETRY,
  PaymentOrderCompletedSchema,
  TOPICS,
  type KafkaTopic,
  type PaymentOrderCompletedEvent,
  validateKafkaEvent,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import { createInstructorEarning } from './earnings-service.js';

const HANDLER_GROUP = 'payment-service.earnings-writer';

export async function startKafkaConsumers(): Promise<void> {
  const producer = await createProducer();
  const topics: KafkaTopic[] = [
    TOPICS.PAYMENT_ORDER_COMPLETED,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_5S,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_30S,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_1M,
  ];

  const handler = async (event: { data: PaymentOrderCompletedEvent; trace_id: string }) => {
    const validated = validateKafkaEvent(
      PaymentOrderCompletedSchema,
      event.data,
      'payment.order.completed',
      logger,
    );
    if (!validated) return;

    await createInstructorEarning(
      validated.order_id,
      validated.instructor_id,
      validated.course_id,
      validated.amount,
    );

    logger.info(
      {
        orderId: validated.order_id,
        instructorId: validated.instructor_id,
        traceId: event.trace_id,
      },
      'Instructor earning ensured from payment event',
    );
  };

  await Promise.all(
    topics.map(async (topic) => {
      const consumer = await createConsumer(`${HANDLER_GROUP}.${topic}`);
      await consumeWithRetry<PaymentOrderCompletedEvent>(consumer, producer, {
        topic,
        groupId: `${HANDLER_GROUP}.${topic}`,
        retry: PAYMENT_ORDER_COMPLETED_RETRY,
        handler: async (event) => handler(event),
        onError: (err) => logger.error({ err, topic }, 'Payment earnings consumer failed'),
      });
      logger.info({ topic }, 'Payment earnings consumer running');
    }),
  );
}
