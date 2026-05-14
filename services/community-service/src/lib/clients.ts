import { logger } from '@lms/logger';
import prisma from './prisma.js';

const LEARNING_SERVICE_URL = (process.env.LEARNING_SERVICE_URL || 'http://localhost:3006').replace(/\/$/, '');
const COURSE_SERVICE_URL = (process.env.COURSE_SERVICE_URL || 'http://localhost:3002').replace(/\/$/, '');
const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://localhost:3101').replace(/\/$/, '');
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';
const TIMEOUT_MS = 5000;

type InternalEnrollmentResponse = { data?: { enrolled?: boolean } };

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkEnrollmentFromLearningService(userId: string, courseId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${LEARNING_SERVICE_URL}/internal/enrollment/check?userId=${userId}&courseId=${courseId}`,
      {
        headers: {
          'x-internal-call': 'community-service',
          'x-internal-secret': INTERNAL_SERVICE_SECRET,
        },
      },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as InternalEnrollmentResponse;
    return Boolean(json?.data?.enrolled);
  } catch (err) {
    logger.warn({ err, userId, courseId }, '[community-service] checkEnrollmentFromLearningService failed');
    return false;
  }
}

async function rememberEnrollmentPermission(
  userId: string,
  courseId: string,
  source: 'kafka' | 'internal-fallback',
): Promise<void> {
  try {
    await prisma.courseEnrollmentPermission.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: {
        userId,
        courseId,
        enrolledAt: new Date(),
        source,
      },
      update: { source },
    });
  } catch (err) {
    logger.warn({ err, userId, courseId, source }, '[community-service] rememberEnrollmentPermission failed');
  }
}

// Uu tien read model local de giam coupling runtime voi learning-service.
export async function checkEnrollment(userId: string, courseId: string): Promise<boolean> {
  try {
    const localPermission = await prisma.courseEnrollmentPermission.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    if (localPermission) return true;
  } catch (err) {
    logger.warn({ err, userId, courseId }, '[community-service] local enrollment permission lookup failed');
  }

  const enrolled = await checkEnrollmentFromLearningService(userId, courseId);
  if (enrolled) {
    await rememberEnrollmentPermission(userId, courseId, 'internal-fallback');
  }
  return enrolled;
}

// Lay thong tin course tu course-service (de lay title, slug, instructorId)
export async function getCourseById(courseId: string): Promise<{ id: string; title: string; slug: string; instructorId?: string } | null> {
  try {
    const res = await fetchWithTimeout(`${COURSE_SERVICE_URL}/internal/courses/${courseId}`, {
      headers: {
        'x-internal-call': 'community-service',
        'x-internal-secret': INTERNAL_SERVICE_SECRET,
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: string; title: string; slug: string; instructorId?: string } };
    return json?.data ?? null;
  } catch (err) {
    logger.warn({ err, courseId }, '[community-service] getCourseById failed');
    return null;
  }
}

// Lay thong tin lesson tu course-service (id, title)
export async function getLessonById(lessonId: string): Promise<{ id: string; title: string } | null> {
  try {
    const res = await fetchWithTimeout(`${COURSE_SERVICE_URL}/internal/lessons/${lessonId}`, {
      headers: {
        'x-internal-call': 'community-service',
        'x-internal-secret': INTERNAL_SERVICE_SECRET,
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: string; title: string } };
    return json?.data ?? null;
  } catch (err) {
    logger.warn({ err, lessonId }, '[community-service] getLessonById failed');
    return null;
  }
}

// Lay danh sach course IDs cua 1 instructor
export async function getInstructorCourseIds(instructorId: string): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(`${COURSE_SERVICE_URL}/internal/instructors/${instructorId}/courses`, {
      headers: {
        'x-internal-call': 'community-service',
        'x-internal-secret': INTERNAL_SERVICE_SECRET,
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { courseIds?: string[] } };
    return json?.data?.courseIds ?? [];
  } catch (err) {
    logger.warn({ err, instructorId }, '[community-service] getInstructorCourseIds failed');
    return [];
  }
}

const userNameCache = new Map<string, { name: string; username: string | null; role: string; expiresAt: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 phut

export async function resolveUserNames(
  userIds: string[],
): Promise<Map<string, { name: string; username: string | null; role?: string }>> {
  const result = new Map<string, { name: string; username: string | null; role?: string }>();
  const uncachedIds: string[] = [];
  const now = Date.now();

  for (const id of userIds) {
    const cached = userNameCache.get(id);
    if (cached && cached.expiresAt > now) {
      result.set(id, { name: cached.name, username: cached.username, role: cached.role });
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length === 0) return result;

  try {
    const res = await fetchWithTimeout(`${AUTH_SERVICE_URL}/internal/users/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': 'community-service',
        'x-internal-secret': INTERNAL_SERVICE_SECRET,
      },
      body: JSON.stringify({ userIds: uncachedIds }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { users?: Record<string, { name: string; username: string | null; role?: string }> };
      };
      const usersMap = json?.data?.users;
      if (usersMap) {
        for (const [id, info] of Object.entries(usersMap)) {
          result.set(id, { name: info.name, username: info.username, role: info.role });
          userNameCache.set(id, {
            name: info.name,
            username: info.username,
            role: info.role || '',
            expiresAt: now + USER_CACHE_TTL,
          });
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, '[community-service] resolveUserNames failed - fallback');
  }

  return result;
}

export function getDisplayName(
  userId: string,
  nameMap: Map<string, { name: string; username: string | null; role?: string }>,
): string {
  const info = nameMap.get(userId);
  return info?.name || info?.username || `Nguoi dung #${userId.slice(0, 6)}`;
}
