import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'lms-platform',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

export const createProducer = async (): Promise<Producer> => {
  const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  });
  await producer.connect();
  return producer;
};

export const createConsumer = async (groupId: string): Promise<Consumer> => {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  return consumer;
};

export const TOPICS = {
  ENROLLMENT_CREATED: 'learning.enrollment.created',
  LESSON_COMPLETED: 'learning.lesson.completed',
  COURSE_COMPLETED: 'learning.course.completed',
  /** Admin / catalog: course lifecycle (publish, archive, reopen). */
  COURSE_CATALOG_STATUS_CHANGED: 'course.catalog.status-changed',
} as const;

export { kafka };
export default kafka;
