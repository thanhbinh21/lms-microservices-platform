import { createConsumer, TOPICS } from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from './prisma.js';

let started = false;

function headerToString(raw: Buffer | string | Array<Buffer | string> | undefined): string | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return headerToString(raw[0]);
  return Buffer.isBuffer(raw) ? raw.toString('utf-8') : String(raw);
}

function nextOffset(offset: string): string {
  return (BigInt(offset) + 1n).toString();
}

function parseJson(value: string): { parsed: unknown; eventId?: string; traceId?: string; eventType?: string } {
  try {
    const parsed = JSON.parse(value) as {
      event_id?: string;
      trace_id?: string;
      event_type?: string;
    };
    return {
      parsed,
      eventId: parsed.event_id,
      traceId: parsed.trace_id,
      eventType: parsed.event_type,
    };
  } catch {
    return { parsed: { raw: value } };
  }
}

export async function startDlqProcessor(): Promise<void> {
  if (started) return;
  started = true;

  const consumer = await createConsumer('learning-service.dlq-processor');
  await consumer.subscribe({ topic: TOPICS.DEAD_LETTER, fromBeginning: false });

  await consumer.run({
    autoCommit: false,
    eachMessage: async (payload) => {
      const value = payload.message.value?.toString('utf-8') || '{}';
      const headers = payload.message.headers || {};
      const parsed = parseJson(value);
      const originalTopic =
        headerToString(headers['x-original-topic']) || parsed.eventType || TOPICS.DEAD_LETTER;
      const eventId = headerToString(headers['x-event-id']) || parsed.eventId;
      const traceId = headerToString(headers['x-trace-id']) || parsed.traceId;
      const retryCount = Number(headerToString(headers['x-retry-count']) || 0);
      const errorMessage = headerToString(headers['x-failure-reason']) || 'Kafka event moved to DLQ';
      const originalKey = payload.message.key?.toString('utf-8');

      if (eventId) {
        await prisma.failedEvent.upsert({
          where: { topic_eventId: { topic: originalTopic, eventId } },
          create: {
            topic: originalTopic,
            eventId,
            traceId,
            originalKey,
            payload: parsed.parsed as object,
            errorMessage,
            retryCount,
          },
          update: {
            traceId,
            originalKey,
            payload: parsed.parsed as object,
            errorMessage,
            retryCount,
          },
        });
      } else {
        await prisma.failedEvent.create({
          data: {
            topic: originalTopic,
            traceId,
            originalKey,
            payload: parsed.parsed as object,
            errorMessage,
            retryCount,
          },
        });
      }

      await consumer.commitOffsets([
        {
          topic: payload.topic,
          partition: payload.partition,
          offset: nextOffset(payload.message.offset),
        },
      ]);

      logger.warn(
        { originalTopic, eventId, traceId, retryCount },
        '[learning-service] DLQ event persisted',
      );
    },
  });

  logger.info('[learning-service] DLQ processor running');
}
