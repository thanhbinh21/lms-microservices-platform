import {
  createProducer,
  publishEvent as publishTypedKafkaEvent,
  type KafkaTopic,
  type TopicEventMap,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';

type Producer = Awaited<ReturnType<typeof createProducer>>;

let producer: Producer | null = null;

export async function getOrCreateProducer(): Promise<Producer> {
  if (!producer) {
    producer = await createProducer();
    logger.info('Kafka producer connected (course-service)');
  }
  return producer;
}

export async function publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const p = await getOrCreateProducer();
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

export async function publishTypedEvent<T extends KafkaTopic>(
  topic: T,
  data: TopicEventMap[T],
  options: { traceId?: string; key?: string; eventId?: string; headers?: Record<string, string> } = {},
): Promise<void> {
  try {
    const p = await getOrCreateProducer();
    await publishTypedKafkaEvent(p, topic, data, options);
    logger.info({ topic, key: options.key }, 'Kafka typed event published');
  } catch (err) {
    logger.warn({ err, topic }, 'Failed to publish typed Kafka event - continuing without rollback');
  }
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
