import '../lib/load-env';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma';
import { upsertAutoContextAndQueueStt } from '../lib/transcript-jobs';

const BATCH_SIZE = Number(process.env.TRANSCRIPT_BACKFILL_BATCH_SIZE || 100);

async function main(): Promise<void> {
  let cursor: string | undefined;
  let processed = 0;
  let queued = 0;

  while (true) {
    const lessons = await prisma.lesson.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        title: true,
        content: true,
        videoUrl: true,
        sourceType: true,
        duration: true,
        chapter: {
          select: {
            title: true,
            course: {
              select: {
                title: true,
                description: true,
                level: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (lessons.length === 0) break;

    for (const lesson of lessons) {
      const result = await upsertAutoContextAndQueueStt({
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        sourceType: lesson.sourceType,
        duration: lesson.duration,
        chapterTitle: lesson.chapter.title,
        courseTitle: lesson.chapter.course.title,
        courseDescription: lesson.chapter.course.description,
        courseLevel: lesson.chapter.course.level,
        courseCategory: lesson.chapter.course.category?.name ?? null,
      }, 'backfill-ai-context');
      processed++;
      if (result.queued) queued++;
    }

    cursor = lessons[lessons.length - 1]?.id;
    logger.info({ processed, queued }, '[AI-CONTEXT-BACKFILL] Batch completed');
  }

  logger.info({ processed, queued }, '[AI-CONTEXT-BACKFILL] Done');
}

main()
  .catch((err) => {
    logger.error({ err }, '[AI-CONTEXT-BACKFILL] Failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
