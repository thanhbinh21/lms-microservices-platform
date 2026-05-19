import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { logger } from '@lms/logger';
import type { Prisma } from '../generated/prisma/index.js';
import {
  buildAutoContextText,
  computeContentHash,
  getContentKindForSource,
  getQualityForSource,
  pickBestTranscript,
  type LessonForAiContext,
  type TranscriptCandidate,
} from '../lib/transcript-context';
import { enqueueAutoSttJob } from '../lib/transcript-jobs';

type LessonTranscriptForContext = TranscriptCandidate & {
  lessonId?: string;
  durationSec?: number | null;
  confidence?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  generatedAt?: Date | null;
  videoHash?: string | null;
  jobId?: string | null;
};

type LessonAiContextRecord = LessonForAiContext & {
  chapter: {
    title: string;
    course: {
      id: string;
      title: string;
      description: string | null;
      level: string;
      category: { name: string } | null;
    };
  };
  transcripts: LessonTranscriptForContext[];
};

function normalizeLessonForContext(lesson: LessonForAiContext): LessonForAiContext {
  return {
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    sourceType: lesson.sourceType,
    duration: lesson.duration,
    chapterTitle: lesson.chapterTitle,
    courseTitle: lesson.courseTitle,
    courseDescription: lesson.courseDescription,
    courseLevel: lesson.courseLevel,
    courseCategory: lesson.courseCategory,
  };
}

function buildLessonAiContextPayload(lesson: LessonAiContextRecord) {
  const transcript = pickBestTranscript(lesson.transcripts);
  const readyTranscript = transcript?.status === 'READY' && transcript.fullText?.trim()
    ? transcript
    : undefined;
  const fallbackText = buildAutoContextText({
    ...normalizeLessonForContext(lesson),
    chapterTitle: lesson.chapter.title,
    courseTitle: lesson.chapter.course.title,
    courseDescription: lesson.chapter.course.description,
    courseLevel: lesson.chapter.course.level,
    courseCategory: lesson.chapter.course.category?.name ?? null,
  });
  const sourceType = readyTranscript?.sourceType ?? 'AUTO_CONTEXT';
  const contentKind = readyTranscript?.contentKind ?? getContentKindForSource(sourceType);
  const textContent = (sourceType === 'AUTO_CONTEXT' ? fallbackText : readyTranscript?.fullText ?? fallbackText).trim();
  const sources = new Set<string>(['LESSON_METADATA']);

  if (lesson.content?.trim()) {
    sources.add('LESSON_CONTENT');
  }
  if (textContent) {
    sources.add(sourceType);
  }

  const autoSttEnabled = process.env.TRANSCRIPT_AUTO_STT_ENABLED === 'true';
  const processing = autoSttEnabled && lesson.transcripts.some(
    (item) => item.sourceType === 'AUTO_STT' && ['PENDING', 'PROCESSING'].includes(item.status),
  );
  const failedAutoStt = autoSttEnabled && lesson.transcripts.some(
    (item) => item.sourceType === 'AUTO_STT' && item.status === 'FAILED',
  );

  return {
    lessonId: lesson.id,
    courseId: lesson.chapter.course.id,
    courseTitle: lesson.chapter.course.title,
    lessonTitle: lesson.title,
    available: textContent.length > 0,
    sourceType,
    contentKind,
    quality: getQualityForSource(sourceType),
    fallbackUsed: sourceType === 'AUTO_CONTEXT',
    processing,
    failedAutoStt,
    transcriptStatus: readyTranscript?.status ?? transcript?.status ?? 'READY',
    contentLength: textContent.length,
    reason: textContent.length > 0 ? undefined : 'NO_CONTEXT',
    textContent,
    segments: readyTranscript?.segments ?? null,
    language: readyTranscript?.language ?? 'vi',
    updatedAt: readyTranscript?.updatedAt ?? null,
    sources: Array.from(sources),
    metadata: {
      lessonId: lesson.id,
      title: lesson.title,
      content: lesson.content,
      videoUrl: lesson.videoUrl,
      sourceType: lesson.sourceType,
      duration: lesson.duration,
      chapterTitle: lesson.chapter.title,
      courseId: lesson.chapter.course.id,
      courseTitle: lesson.chapter.course.title,
      courseDescription: lesson.chapter.course.description,
      level: lesson.chapter.course.level,
      category: lesson.chapter.course.category?.name ?? '',
    },
  };
}

function parseSubtitleTime(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length < 2) return 0;

  const seconds = Number(parts.pop() || 0);
  const minutes = Number(parts.pop() || 0);
  const hours = Number(parts.pop() || 0);
  return Math.max(0, hours * 3600 + minutes * 60 + seconds);
}

function parseSubtitleContent(raw: string): { fullText: string; segments: Array<{ start: number; end: number; text: string }> } {
  const blocks = raw.replace(/\r/g, '').split(/\n\s*\n/);
  const segments: Array<{ start: number; end: number; text: string }> = [];
  const plainText: string[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line !== 'WEBVTT' && !/^\d+$/.test(line));

    if (lines.length === 0) continue;

    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex >= 0) {
      const [startRaw, endRaw] = lines[timeIndex].split('-->').map((value) => value.trim().split(/\s+/)[0]);
      const text = lines.slice(timeIndex + 1).join(' ').trim();
      if (text) {
        segments.push({ start: parseSubtitleTime(startRaw || '0'), end: parseSubtitleTime(endRaw || '0'), text });
        plainText.push(text);
      }
      continue;
    }

    const text = lines.join(' ').trim();
    if (text) plainText.push(text);
  }

  return { fullText: plainText.join(' ').trim(), segments };
}

/**
 * Endpoints noi bo — chi cho cac service khac trong cluster goi truc tiep
 * (khong di qua Kong). Phat hien bang header `x-internal-call`.
 *
 * Payment-service dung endpoint nay de verify price (chong client tampering).
 */

/**
 * GET /internal/courses/:id — tra ve thong tin toi thieu de tinh gia.
 */
export const getCourseByIdInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        status: true,
        instructorId: true,
        totalLessons: true,
        totalDuration: true,
        level: true,
        thumbnail: true,
      },
    });

    if (!course) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const serializedCourse = { ...course, price: course.price.toNumber() };

    const response: ApiResponse<typeof serializedCourse> = {
      success: true,
      code: 200,
      message: 'OK',
      data: serializedCourse,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getCourseByIdInternal error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal Server Error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/courses/:id/curriculum
 * Tra ve danh sach chapter + lessons cua 1 course.
 * Learning-service dung de render trang /learn.
 * Ai-service dung de lay context cho chatbot + quiz.
 */
export const getCourseCurriculumInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        level: true,
        category: { select: { name: true } },
        instructorId: true,
        chapters: {
          // Khong bat buoc chapter publish neu ben trong da co bai publish,
          // tranh khoa hoc moi tao bi an lesson khi quen publish chuong.
          where: { lessons: { some: { isPublished: true } } },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            lessons: {
              where: { isPublished: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                order: true,
                content: true,
                videoUrl: true,
                sourceType: true,
                duration: true,
                isFree: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    // Build instructorName from auth-service (batch lookup)
    // For now, return instructorId — caller (ai-service) can fetch batch names
    const response: ApiResponse<{
      id: string;
      title: string;
      description: string | null;
      level: string;
      category: string;
      instructorId: string;
      instructorName?: string;
      curriculum: typeof course.chapters;
    }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: {
        id: course.id,
        title: course.title,
        description: course.description,
        level: course.level,
        category: course.category?.name || '',
        instructorId: course.instructorId,
        curriculum: course.chapters,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getCourseCurriculumInternal error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal Server Error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/lessons/:id
 * Tra ve thong tin lesson: courseId, chapterId, isFree, duration, content.
 * Learning-service dung de verify enrollment truoc khi update progress.
 * Ai-service dung de lay noi dung bai hoc lam AI context.
 */
export const getLessonByIdInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        videoUrl: true,
        sourceType: true,
        duration: true,
        isFree: true,
        chapter: {
          select: { id: true, courseId: true },
        },
      },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const data = {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      videoUrl: lesson.videoUrl,
      sourceType: lesson.sourceType,
      duration: lesson.duration,
      isFree: lesson.isFree,
      chapterId: lesson.chapter.id,
      courseId: lesson.chapter.courseId,
    };

    const response: ApiResponse<typeof data> = {
      success: true, code: 200, message: 'OK', data, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getLessonByIdInternal error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/lessons/:id/ai-context-status
 * Tra ve trang thai AI context cho 1 lesson.
 * Ai-service goi de kiem tra lesson co du context de chatbot/quiz.
 */
export const getLessonAiContextStatus = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
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
              select: { id: true, title: true, description: true, level: true, category: { select: { name: true } } },
            },
          },
        },
        transcripts: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            lessonId: true,
            sourceType: true,
            contentKind: true,
            status: true,
            fullText: true,
            segments: true,
            language: true,
            durationSec: true,
            confidence: true,
            errorCode: true,
            errorMessage: true,
            generatedAt: true,
            videoHash: true,
            jobId: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const context = buildLessonAiContextPayload(lesson);

    const response: ApiResponse<{
      available: boolean;
      sources: string[];
      transcriptStatus: string | null;
      contentLength?: number;
      sourceType?: string;
      contentKind?: string;
      quality?: string;
      fallbackUsed?: boolean;
      processing?: boolean;
      failedAutoStt?: boolean;
      reason?: string;
    }> = {
      success: true, code: 200, message: 'OK',
      data: {
        available: context.available,
        sources: context.sources,
        transcriptStatus: context.transcriptStatus,
        contentLength: context.contentLength,
        sourceType: context.sourceType,
        contentKind: context.contentKind,
        quality: context.quality,
        fallbackUsed: context.fallbackUsed,
        processing: context.processing,
        failedAutoStt: context.failedAutoStt,
        reason: context.reason,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getLessonAiContextStatus error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/lessons/:id/ai-context
 * Tra ve context tot nhat cho AI theo priority MANUAL -> SUBTITLE_UPLOAD -> AUTO_STT -> AUTO_CONTEXT.
 */
export const getLessonAiContext = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
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
              select: { id: true, title: true, description: true, level: true, category: { select: { name: true } } },
            },
          },
        },
        transcripts: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            lessonId: true,
            sourceType: true,
            contentKind: true,
            status: true,
            fullText: true,
            segments: true,
            language: true,
            durationSec: true,
            confidence: true,
            errorCode: true,
            errorMessage: true,
            generatedAt: true,
            videoHash: true,
            jobId: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const context = buildLessonAiContextPayload(lesson);
    const response: ApiResponse<typeof context> = {
      success: true, code: 200, message: 'OK', data: context, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getLessonAiContext error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/lessons/:id/transcript
 * Tra ve transcript cua 1 lesson (fullText + segments).
 */
export const getLessonTranscript = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const transcripts = await prisma.lessonTranscript.findMany({
      where: { lessonId: id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        lessonId: true,
        sourceType: true,
        contentKind: true,
        status: true,
        fullText: true,
        segments: true,
        language: true,
        durationSec: true,
        confidence: true,
        errorCode: true,
        errorMessage: true,
        generatedAt: true,
        videoHash: true,
        jobId: true,
        updatedAt: true,
      },
    });
    const transcript = pickBestTranscript(transcripts);

    if (!transcript) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Transcript not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof transcript> = {
      success: true, code: 200, message: 'OK', data: transcript, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getLessonTranscript error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * POST /internal/lessons/:id/transcript/manual
 * Instructor dan transcript thu cong.
 */
export const createManualTranscript = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string | undefined;
  const { id } = req.params;

  try {
    const { fullText, segments, language } = req.body as {
      fullText?: string;
      segments?: unknown[];
      language?: string;
    };

    if (!fullText || fullText.trim().length === 0) {
      const response: ApiResponse<null> = {
        success: false, code: 400, message: 'Transcript cannot be empty', data: null, trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    // Verify lesson ownership (instructor owns the course)
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true, chapter: { select: { course: { select: { instructorId: true } } } } },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (lesson.chapter.course.instructorId !== instructorId && userRole?.toLowerCase() !== 'admin') {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    // Upsert transcript
    const transcript = await prisma.lessonTranscript.upsert({
      where: { id: `manual-${id}` },
      create: {
        id: `manual-${id}`,
        lessonId: id,
        sourceType: 'MANUAL',
        contentKind: 'VERBATIM_TRANSCRIPT',
        provider: 'manual',
        language: language || 'vi',
        status: 'READY',
        fullText,
        contentHash: computeContentHash(fullText),
        segments: segments as Prisma.InputJsonValue | undefined,
        generatedAt: new Date(),
      },
      update: {
        sourceType: 'MANUAL',
        contentKind: 'VERBATIM_TRANSCRIPT',
        provider: 'manual',
        language: language || 'vi',
        status: 'READY',
        fullText,
        contentHash: computeContentHash(fullText),
        segments: segments as Prisma.InputJsonValue | undefined,
        generatedAt: new Date(),
      },
    });

    logger.info({ lessonId: id, instructorId, traceId }, 'Manual transcript created');

    const response: ApiResponse<typeof transcript> = {
      success: true, code: 201, message: 'Manual transcript saved', data: transcript, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    logger.error({ err, id }, 'createManualTranscript error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * POST /internal/lessons/:id/transcript/subtitle
 * Luu phu de upload (.srt/.vtt da doc thanh text) lam context uu tien sau MANUAL.
 */
export const createSubtitleTranscript = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string | undefined;
  const { id } = req.params;

  try {
    const { subtitleText, fullText, language, fileName } = req.body as {
      subtitleText?: string;
      fullText?: string;
      language?: string;
      fileName?: string;
    };
    const rawSubtitle = (subtitleText ?? fullText ?? '').trim();

    if (!rawSubtitle) {
      const response: ApiResponse<null> = {
        success: false, code: 400, message: 'Subtitle content cannot be empty', data: null, trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true, chapter: { select: { course: { select: { instructorId: true } } } } },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (lesson.chapter.course.instructorId !== instructorId && userRole?.toLowerCase() !== 'admin') {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const parsed = parseSubtitleContent(rawSubtitle);
    if (!parsed.fullText) {
      const response: ApiResponse<null> = {
        success: false, code: 400, message: 'Subtitle has no readable text', data: null, trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const transcript = await prisma.lessonTranscript.upsert({
      where: { id: `subtitle-${id}` },
      create: {
        id: `subtitle-${id}`,
        lessonId: id,
        sourceType: 'SUBTITLE_UPLOAD',
        contentKind: 'VERBATIM_TRANSCRIPT',
        provider: fileName ? `subtitle-upload:${fileName}` : 'subtitle-upload',
        language: language || 'vi',
        status: 'READY',
        fullText: parsed.fullText,
        segments: parsed.segments as Prisma.InputJsonValue,
        contentHash: computeContentHash(parsed.fullText),
        generatedAt: new Date(),
      },
      update: {
        sourceType: 'SUBTITLE_UPLOAD',
        contentKind: 'VERBATIM_TRANSCRIPT',
        provider: fileName ? `subtitle-upload:${fileName}` : 'subtitle-upload',
        language: language || 'vi',
        status: 'READY',
        fullText: parsed.fullText,
        segments: parsed.segments as Prisma.InputJsonValue,
        contentHash: computeContentHash(parsed.fullText),
        errorCode: null,
        errorMessage: null,
        generatedAt: new Date(),
      },
    });

    logger.info({ lessonId: id, instructorId, traceId }, 'Subtitle transcript created');

    const response: ApiResponse<typeof transcript> = {
      success: true, code: 201, message: 'Subtitle transcript saved', data: transcript, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    logger.error({ err, id }, 'createSubtitleTranscript error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * POST /internal/lessons/:id/transcript/retry
 * Retry auto transcript sau khi that bai.
 */
export const retryTranscript = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const instructorId = res.locals.userId as string;
  const userRole = res.locals.userRole as string | undefined;
  const { id } = req.params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        videoUrl: true,
        sourceType: true,
        duration: true,
        chapter: { select: { course: { select: { instructorId: true } } } },
      },
    });

    if (!lesson) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'Lesson not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (lesson.chapter.course.instructorId !== instructorId && userRole?.toLowerCase() !== 'admin') {
      const response: ApiResponse<null> = {
        success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    if (!lesson.videoUrl) {
      const response: ApiResponse<null> = {
        success: false, code: 400, message: 'Lesson has no video source for AUTO_STT', data: null, trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const queued = await enqueueAutoSttJob(lesson, traceId, { force: true });
    logger.info({ lessonId: id, instructorId, traceId, queued }, 'Transcript retry requested');

    const responseMessage = queued.queued
      ? 'Transcript retry queued'
      : 'AUTO_STT is disabled; AI uses keyword context';
    const response: ApiResponse<{ lessonId: string; status: string; jobId: string | null; reason?: string }> = {
      success: true,
      code: queued.queued ? 202 : 200,
      message: responseMessage,
      data: { lessonId: id, status: queued.queued ? 'QUEUED' : 'SKIPPED', jobId: queued.jobId, reason: queued.reason },
      trace_id: traceId,
    };
    return res.status(response.code).json(response);
  } catch (err) {
    logger.error({ err, id }, 'retryTranscript error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

/**
 * GET /internal/instructors/:instructorId/courses
 * Tra ve danh sach course IDs cua 1 instructor.
 * Community-service dung de loc cau hoi theo khoa hoc cua giang vien.
 */
export const getInstructorCourseIdsInternal = async (req: Request, res: Response): Promise<Response | void> => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { instructorId } = req.params;

  try {
    const courses = await prisma.course.findMany({
      where: { instructorId },
      select: { id: true, title: true, slug: true },
    });

    const data = {
      courseIds: courses.map((c) => c.id),
      courses: courses,
    };

    const response: ApiResponse<typeof data> = {
      success: true, code: 200, message: 'OK', data, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, instructorId }, 'getInstructorCourseIdsInternal error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal Server Error', data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};
