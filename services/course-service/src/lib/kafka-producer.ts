import { createProducer } from '@lms/kafka-client';
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

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
