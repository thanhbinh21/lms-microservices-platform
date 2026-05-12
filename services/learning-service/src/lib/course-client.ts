import { logger } from '@lms/logger';

const COURSE_SERVICE_URL = (process.env.COURSE_SERVICE_URL || 'http://localhost:3002').replace(/\/$/, '');
const TIMEOUT_MS = 8000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CourseBasicInfo {
  id: string;
  price: number;
  status: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  totalLessons: number;
  totalDuration: number;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  instructorId: string;
}

export interface LessonBasicInfo {
  id: string;
  courseId: string;
  chapterId: string;
  isFree: boolean;
  duration: number;
  title: string;
}

export interface ChapterWithLessons {
  id: string;
  title: string;
  order: number;
  lessons: Array<{
    id: string;
    title: string;
    order: number;
    content: string | null;
    videoUrl: string | null;
    sourceType: string;
    duration: number;
    isFree: boolean;
  }>;
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Derive contentType from lesson data:
 * - If videoUrl is set and sourceType is YOUTUBE  -> 'YOUTUBE'
 * - If videoUrl is set and sourceType is UPLOAD    -> 'VIDEO'
 * - If content (text) is set                       -> 'TEXT'
 * - Otherwise                                      -> null
 */
function deriveContentType(
  content: string | null,
  videoUrl: string | null,
  sourceType: string | null,
): 'TEXT' | 'VIDEO' | 'YOUTUBE' | null {
  if (videoUrl) {
    if (sourceType === 'YOUTUBE') return 'YOUTUBE';
    return 'VIDEO';
  }
  if (content) return 'TEXT';
  return null;
}

/**
 * Lay thong tin course tu course-service (internal API).
 * Chi tra ve thong tin co ban, KHONG bao gom chapters/lessons.
 */
export async function getCourseById(courseId: string): Promise<CourseBasicInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${COURSE_SERVICE_URL}/internal/courses/${courseId}`, {
      signal: controller.signal,
      headers: { 'x-internal-call': 'true' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const json = (await res.json()) as any;
    return json?.data ?? null;
  } catch (err) {
    logger.warn({ err, courseId }, '[learning-service] getCourseById failed');
    return null;
  }
}

/**
 * Lay thong tin lesson tu course-service (internal API).
 */
export async function getLessonById(lessonId: string): Promise<LessonBasicInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${COURSE_SERVICE_URL}/internal/lessons/${lessonId}`, {
      signal: controller.signal,
      headers: { 'x-internal-call': 'true' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const json = (await res.json()) as any;
    return json?.data ?? null;
  } catch (err) {
    logger.warn({ err, lessonId }, '[learning-service] getLessonById failed');
    return null;
  }
}

/**
 * Lay danh sach chapter + lessons cua 1 course tu course-service (internal API).
 * Dung de render trang /learn.
 */
export async function getCourseCurriculum(
  courseId: string,
): Promise<ChapterWithLessons[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${COURSE_SERVICE_URL}/internal/courses/${courseId}/curriculum`, {
      signal: controller.signal,
      headers: { 'x-internal-call': 'true' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn({ status: res.status, courseId }, '[learning-service] getCourseCurriculum failed');
      return null;
    }
    const json = (await res.json()) as any;
    return json?.data ?? null;
  } catch (err) {
    logger.warn({ err, courseId }, '[learning-service] getCourseCurriculum failed');
    return null;
  }
}
