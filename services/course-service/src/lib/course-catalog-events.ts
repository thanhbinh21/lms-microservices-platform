import {
  TOPICS,
  type CourseCatalogAction,
  type CourseCatalogSnapshot,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from './prisma.js';
import { publishTypedEvent } from './kafka-producer.js';

const TOPIC_BY_ACTION = {
  published: TOPICS.COURSE_PUBLISHED,
  updated: TOPICS.COURSE_UPDATED,
  archived: TOPICS.COURSE_ARCHIVED,
  deleted: TOPICS.COURSE_DELETED,
  review_changed: TOPICS.COURSE_REVIEW_CHANGED,
} as const satisfies Record<CourseCatalogAction, typeof TOPICS[keyof typeof TOPICS]>;

export async function buildCourseCatalogSnapshot(courseId: string): Promise<CourseCatalogSnapshot | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      title: true,
      slug: true,
      description: true,
      thumbnail: true,
      price: true,
      level: true,
      status: true,
      categoryId: true,
      instructorId: true,
      totalLessons: true,
      totalDuration: true,
      averageRating: true,
      ratingCount: true,
      enrollmentCount: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true, slug: true } },
    },
  });

  if (!course) return null;

  return {
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnail: course.thumbnail,
    price: Number(course.price),
    level: course.level,
    status: course.status,
    categoryId: course.categoryId,
    categoryName: course.category?.name ?? null,
    categorySlug: course.category?.slug ?? null,
    instructorId: course.instructorId,
    totalLessons: course.totalLessons,
    totalDuration: course.totalDuration,
    averageRating: course.averageRating,
    ratingCount: course.ratingCount,
    enrollmentCount: course.enrollmentCount,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

export async function publishCourseCatalogEvent(
  courseId: string,
  action: CourseCatalogAction,
  traceId: string,
): Promise<void> {
  const snapshotNeeded = action === 'published' || action === 'updated' || action === 'review_changed';
  const snapshot = snapshotNeeded ? await buildCourseCatalogSnapshot(courseId) : undefined;

  if (snapshotNeeded && !snapshot) {
    logger.warn({ courseId, action }, '[course-service] Skip catalog event because snapshot is missing');
    return;
  }

  await publishTypedEvent(TOPIC_BY_ACTION[action], {
    course_id: courseId,
    action,
    timestamp: new Date().toISOString(),
    ...(snapshot ? { snapshot } : {}),
  }, {
    traceId,
    key: courseId,
  });
}
