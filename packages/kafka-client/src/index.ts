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

export { kafka };
export default kafka;
