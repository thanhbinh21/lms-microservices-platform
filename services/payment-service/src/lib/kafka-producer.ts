import {
  createProducer,
  publishEvent,
  TOPICS,
  type PaymentOrderCompletedEvent,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';

type Producer = Awaited<ReturnType<typeof createProducer>>;

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = await createProducer();
    logger.info('Kafka producer connected (payment-service)');
  }
  return producer;
}

export async function publishPaymentCompleted(
  data: PaymentOrderCompletedEvent,
  traceId?: string,
): Promise<void> {
  const p = await getProducer();
  await publishEvent(p, TOPICS.PAYMENT_ORDER_COMPLETED, data, {
    traceId,
    key: data.order_id,
  });
  logger.info(
    { orderId: data.order_id, courseId: data.course_id, userId: data.user_id, traceId },
    'Published payment.order.completed',
  );
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
