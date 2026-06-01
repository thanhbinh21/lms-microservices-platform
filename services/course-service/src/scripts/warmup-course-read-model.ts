import '../lib/load-env.js';
import { initCache, closeCache } from '@lms/cache';
import { logger } from '@lms/logger';
import type { CourseCatalogSnapshot } from '@lms/kafka-client';
import prisma from '../lib/prisma.js';
import { clearCourseReadStore, updateCourseReadModel } from '../lib/read-store.js';

type PublishedCourseRow = Awaited<ReturnType<typeof findPublishedCourses>>[number];

function toSnapshot(course: PublishedCourseRow): CourseCatalogSnapshot {
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

function findPublishedCourses() {
  return prisma.course.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
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
    orderBy: { createdAt: 'desc' },
  });
}

async function main(): Promise<void> {
  const redisUrl = process.env.CACHE_REDIS_URL;
  if (!redisUrl) {
    throw new Error('CACHE_REDIS_URL is required to warm course read model');
  }

  await initCache(redisUrl);
  await clearCourseReadStore();

  const courses = await findPublishedCourses();

  for (const course of courses) {
    await updateCourseReadModel(course.id, toSnapshot(course));
  }

  logger.info({ count: courses.length }, '[course-service] Course read model warmup completed');
}

main()
  .catch((err) => {
    logger.error({ err }, '[course-service] Course read model warmup failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeCache();
  });
