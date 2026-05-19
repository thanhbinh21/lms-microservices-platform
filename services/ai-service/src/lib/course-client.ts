import { fetchWithTimeout } from './http.js';
import { AI_SERVICE_ENV } from './env.js';
import { logger } from './logger.js';

// ─── Course Service Internal Client ─────────────────────────────────────────────

export interface LessonContextForAI {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  sourceType: string;
  duration: number | null;
  courseId?: string;
}

export interface ChapterWithLessons {
  id: string;
  title: string;
  order: number;
  lessons: LessonContextForAI[];
}

export interface CourseContextForAI {
  id: string;
  title: string;
  description: string | null;
  level: string;
  category: string;
  instructorId: string;
  instructorName?: string;
  curriculum: ChapterWithLessons[];
}

export interface AiContextStatus {
  available: boolean;
  sources: string[];
  transcriptStatus?: string;
  contentLength?: number;
  sourceType?: string;
  contentKind?: string;
  quality?: string;
  fallbackUsed?: boolean;
  processing?: boolean;
  failedAutoStt?: boolean;
  reason?: string;
}

export interface LessonAiContext {
  lessonId: string;
  courseId: string;
  courseTitle: string;
  lessonTitle: string;
  available: boolean;
  sourceType: string;
  contentKind: string;
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  fallbackUsed: boolean;
  processing: boolean;
  failedAutoStt: boolean;
  transcriptStatus: string;
  contentLength: number;
  reason?: string;
  textContent: string;
  segments: unknown[] | null;
  language: string;
  sources: string[];
  metadata: LessonContextForAI & {
    chapterTitle?: string | null;
    courseTitle: string;
    courseDescription?: string | null;
    level: string;
    category: string;
  };
}

export interface TranscriptData {
  id: string;
  lessonId: string;
  sourceType: string;
  contentKind?: string;
  status: string;
  fullText: string | null;
  segments: unknown[] | null;
  language: string;
}

const COURSE_SERVICE = AI_SERVICE_ENV.COURSE_SERVICE_URL.replace(/\/$/, '');
const INTERNAL_SECRET = AI_SERVICE_ENV.INTERNAL_SERVICE_SECRET;

function internalHeaders(traceId: string) {
  return {
    'Content-Type': 'application/json',
    'x-internal-call': 'ai-service',
    'x-internal-secret': INTERNAL_SECRET,
    'x-trace-id': traceId,
  };
}

export async function fetchCourseContext(courseId: string, traceId: string): Promise<CourseContextForAI | null> {
  try {
    const res = await fetchWithTimeout(
      `${COURSE_SERVICE}/internal/courses/${courseId}/curriculum`,
      { headers: internalHeaders(traceId) },
    );
    if (!res.ok) {
      logger.warn({ courseId, status: res.status }, 'fetchCourseContext failed');
      return null;
    }
    const json = (await res.json()) as { data?: CourseContextForAI };
    return json.data ?? null;
  } catch (err) {
    logger.warn({ err, courseId }, 'fetchCourseContext error');
    return null;
  }
}

export async function fetchLessonContext(lessonId: string, traceId: string): Promise<LessonContextForAI | null> {
  try {
    const res = await fetchWithTimeout(
      `${COURSE_SERVICE}/internal/lessons/${lessonId}`,
      { headers: internalHeaders(traceId) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: LessonContextForAI };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchAiContextStatus(lessonId: string, traceId: string): Promise<AiContextStatus> {
  try {
    const res = await fetchWithTimeout(
      `${COURSE_SERVICE}/internal/lessons/${lessonId}/ai-context-status`,
      { headers: internalHeaders(traceId) },
    );
    if (!res.ok) {
      return { available: false, sources: [], reason: 'COURSE_SERVICE_UNAVAILABLE' };
    }
    const json = (await res.json()) as { data?: AiContextStatus };
    return json.data ?? { available: false, sources: [], reason: 'UNKNOWN' };
  } catch (err) {
    logger.warn({ err, lessonId }, 'fetchAiContextStatus error');
    return { available: false, sources: [], reason: 'COURSE_SERVICE_UNAVAILABLE' };
  }
}

export async function fetchLessonAiContext(lessonId: string, traceId: string): Promise<LessonAiContext | null> {
  try {
    const res = await fetchWithTimeout(
      `${COURSE_SERVICE}/internal/lessons/${lessonId}/ai-context`,
      { headers: internalHeaders(traceId) },
    );
    if (!res.ok) {
      logger.warn({ lessonId, status: res.status }, 'fetchLessonAiContext failed');
      return null;
    }
    const json = (await res.json()) as { data?: LessonAiContext };
    return json.data ?? null;
  } catch (err) {
    logger.warn({ err, lessonId }, 'fetchLessonAiContext error');
    return null;
  }
}

export async function fetchTranscript(lessonId: string, traceId: string): Promise<TranscriptData | null> {
  try {
    const res = await fetchWithTimeout(
      `${COURSE_SERVICE}/internal/lessons/${lessonId}/transcript`,
      { headers: internalHeaders(traceId) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: TranscriptData };
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ─── Learning Service Internal Client ─────────────────────────────────────────

export interface CompletionStatus {
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  isCompleted: boolean;
}

export async function fetchCompletionStatus(
  userId: string,
  courseId: string,
  traceId: string,
): Promise<CompletionStatus | null> {
  try {
    const res = await fetchWithTimeout(
      `${AI_SERVICE_ENV.LEARNING_SERVICE_URL}/internal/courses/${courseId}/completion?userId=${userId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-call': 'ai-service',
          'x-internal-secret': INTERNAL_SECRET,
          'x-trace-id': traceId,
        },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: CompletionStatus };
    return json.data ?? null;
  } catch {
    return null;
  }
}

// Kiem tra bai hoc cu the da hoan thanh chua (dung truoc khi tao lesson quiz).
export async function fetchLessonCompletionStatus(
  userId: string,
  lessonId: string,
  traceId: string,
): Promise<boolean | null> {
  try {
    const res = await fetchWithTimeout(
      `${AI_SERVICE_ENV.LEARNING_SERVICE_URL}/internal/lessons/${lessonId}/completion?userId=${userId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-call': 'ai-service',
          'x-internal-secret': INTERNAL_SECRET,
          'x-trace-id': traceId,
        },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { isCompleted: boolean } };
    return json.data?.isCompleted ?? false;
  } catch {
    return null;
  }
}
