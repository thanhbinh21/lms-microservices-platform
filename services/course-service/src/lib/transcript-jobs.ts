import { logger } from '@lms/logger';
import prisma from './prisma';
import {
  buildAutoContextText,
  buildAutoContextTranscriptId,
  buildAutoSttJobId,
  buildAutoSttTranscriptId,
  computeContentHash,
  computeVideoHash,
  type LessonForAiContext,
} from './transcript-context';

export type EnqueueTranscriptResult = {
  queued: boolean;
  jobId: string | null;
  transcriptId: string | null;
  reason?: string;
};

function getConfiguredSttProvider(): string {
  return process.env.TRANSCRIPT_STT_PROVIDER || 'disabled';
}

function isAutoSttEnabled(): boolean {
  return process.env.TRANSCRIPT_AUTO_STT_ENABLED === 'true' && getConfiguredSttProvider() !== 'disabled';
}

export async function upsertAutoContext(lesson: LessonForAiContext, traceId: string): Promise<void> {
  const fullText = buildAutoContextText(lesson);
  const contentHash = computeContentHash(fullText);

  try {
    await prisma.lessonTranscript.upsert({
      where: { id: buildAutoContextTranscriptId(lesson.id) },
      create: {
        id: buildAutoContextTranscriptId(lesson.id),
        lessonId: lesson.id,
        sourceType: 'AUTO_CONTEXT',
        contentKind: 'AI_CONTEXT',
        provider: 'course-service',
        language: 'vi',
        status: 'READY',
        fullText,
        durationSec: lesson.duration ?? null,
        contentHash,
        videoHash: computeVideoHash(lesson),
        generatedAt: new Date(),
      },
      update: {
        sourceType: 'AUTO_CONTEXT',
        contentKind: 'AI_CONTEXT',
        provider: 'course-service',
        language: 'vi',
        status: 'READY',
        fullText,
        durationSec: lesson.duration ?? null,
        contentHash,
        videoHash: computeVideoHash(lesson),
        errorCode: null,
        errorMessage: null,
        generatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn({ err, lessonId: lesson.id, traceId }, 'upsertAutoContext failed');
  }
}

export async function enqueueAutoSttJob(
  lesson: LessonForAiContext,
  traceId: string,
  options: { force?: boolean } = {},
): Promise<EnqueueTranscriptResult> {
  if (!isAutoSttEnabled()) {
    return { queued: false, jobId: null, transcriptId: null, reason: 'AUTO_STT_DISABLED' };
  }

  const videoHash = computeVideoHash(lesson);
  if (!lesson.videoUrl || !videoHash) {
    return { queued: false, jobId: null, transcriptId: null, reason: 'NO_VIDEO_SOURCE' };
  }

  const jobId = buildAutoSttJobId(lesson.id, videoHash);
  const transcriptId = buildAutoSttTranscriptId(lesson.id, videoHash);
  const provider = getConfiguredSttProvider();

  try {
    const readyTranscript = await prisma.lessonTranscript.findFirst({
      where: {
        lessonId: lesson.id,
        sourceType: 'AUTO_STT',
        videoHash,
        status: 'READY',
        fullText: { not: null },
      },
      select: { id: true },
    });

    if (readyTranscript && !options.force) {
      return { queued: false, jobId, transcriptId, reason: 'AUTO_STT_ALREADY_READY' };
    }

    await prisma.lessonTranscript.updateMany({
      where: {
        lessonId: lesson.id,
        sourceType: 'AUTO_STT',
        NOT: { videoHash },
        status: { in: ['PENDING', 'PROCESSING', 'READY', 'FAILED'] },
      },
      data: { status: 'STALE' },
    });

    await prisma.transcriptJob.updateMany({
      where: {
        lessonId: lesson.id,
        NOT: { videoHash },
        status: { in: ['QUEUED', 'PROCESSING', 'FAILED'] },
      },
      data: { status: 'STALE' },
    });

    const existingJob = await prisma.transcriptJob.findUnique({ where: { id: jobId } });
    if (existingJob?.status === 'COMPLETED' && !options.force) {
      return { queued: false, jobId, transcriptId, reason: 'JOB_ALREADY_COMPLETED' };
    }

    if (existingJob) {
      await prisma.transcriptJob.update({
        where: { id: jobId },
        data: {
          status: 'QUEUED',
          sourceType: lesson.sourceType,
          sourceUrl: lesson.videoUrl,
          videoHash,
          provider,
          attempts: options.force ? 0 : existingJob.attempts,
          lastError: null,
          lockedAt: null,
          completedAt: null,
        },
      });
    } else {
      await prisma.transcriptJob.create({
        data: {
          id: jobId,
          lessonId: lesson.id,
          sourceType: lesson.sourceType,
          sourceUrl: lesson.videoUrl,
          videoHash,
          provider,
          status: 'QUEUED',
        },
      });
    }

    await prisma.lessonTranscript.upsert({
      where: { id: transcriptId },
      create: {
        id: transcriptId,
        lessonId: lesson.id,
        sourceType: 'AUTO_STT',
        contentKind: 'VERBATIM_TRANSCRIPT',
        provider,
        language: 'vi',
        status: 'PENDING',
        durationSec: lesson.duration ?? null,
        videoHash,
        jobId,
      },
      update: {
        sourceType: 'AUTO_STT',
        contentKind: 'VERBATIM_TRANSCRIPT',
        provider,
        language: 'vi',
        status: 'PENDING',
        durationSec: lesson.duration ?? null,
        videoHash,
        jobId,
        errorCode: null,
        errorMessage: null,
      },
    });

    logger.info({ lessonId: lesson.id, jobId, transcriptId, provider, traceId }, 'AUTO_STT job queued');
    return { queued: true, jobId, transcriptId };
  } catch (err) {
    logger.warn({ err, lessonId: lesson.id, traceId }, 'enqueueAutoSttJob failed');
    return { queued: false, jobId, transcriptId, reason: 'QUEUE_WRITE_FAILED' };
  }
}

export async function upsertAutoContextAndQueueStt(
  lesson: LessonForAiContext,
  traceId: string,
): Promise<EnqueueTranscriptResult> {
  await upsertAutoContext(lesson, traceId);
  // Mac dinh khong xu ly audio/video de tranh ton quota STT; AI dung keyword context.
  if (!isAutoSttEnabled()) {
    return { queued: false, jobId: null, transcriptId: null, reason: 'AUTO_STT_DISABLED' };
  }
  return enqueueAutoSttJob(lesson, traceId);
}
