import {
  createConsumer,
  createCourseCatalogRetryPolicy,
  createProducer,
  consumeWithRetry,
  CourseCatalogEventSchema,
  TOPICS,
  type CourseCatalogEvent,
  type KafkaTopic,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import { deleteCourseReadModel, updateCourseReadModel } from './read-store.js';

const COURSE_CATALOG_TOPICS: KafkaTopic[] = [
  TOPICS.COURSE_PUBLISHED,
  TOPICS.COURSE_UPDATED,
  TOPICS.COURSE_ARCHIVED,
  TOPICS.COURSE_DELETED,
  TOPICS.COURSE_REVIEW_CHANGED,
  TOPICS.COURSE_CATALOG_RETRY_5S,
  TOPICS.COURSE_CATALOG_RETRY_1M,
];

export async function startReadModelConsumer(): Promise<void> {
  const producer = await createProducer();

  await Promise.all(
    COURSE_CATALOG_TOPICS.map(async (topic) => {
      const consumer = await createConsumer(`course-service.read-model.${topic}`);
      await consumeWithRetry<CourseCatalogEvent>(consumer, producer, {
        topic,
        groupId: `course-service.read-model.${topic}`,
        retry: createCourseCatalogRetryPolicy(topic),
        handler: async (event) => {
          const data = CourseCatalogEventSchema.parse(event.data);

          if (data.action === 'archived' || data.action === 'deleted') {
            await deleteCourseReadModel(data.course_id);
            return;
          }

          if (!data.snapshot) {
            throw new Error(`Course catalog event ${data.action} missing snapshot`);
          }

          await updateCourseReadModel(data.course_id, data.snapshot);
        },
        onError: (err) => logger.error({ err, topic }, '[course-service] Read model consumer failed'),
      });
      logger.info({ topic }, '[course-service] Course read model consumer running');
    }),
  );
}
