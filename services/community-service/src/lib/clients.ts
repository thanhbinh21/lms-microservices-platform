import { logger } from '@lms/logger';

const LEARNING_SERVICE_URL = (process.env.LEARNING_SERVICE_URL || 'http://localhost:3006').replace(/\/$/, '');
const COURSE_SERVICE_URL = (process.env.COURSE_SERVICE_URL || 'http://localhost:3002').replace(/\/$/, '');
const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Kiem tra user da enroll khoa hoc chua (goi learning-service internal API)
export async function checkEnrollment(userId: string, courseId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${LEARNING_SERVICE_URL}/internal/enrollment/check?userId=${userId}&courseId=${courseId}`,
      { headers: { 'x-internal-call': 'true' } },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as any;
    return !!json?.data?.enrolled;
  } catch (err) {
    logger.warn({ err, userId, courseId }, '[community-service] checkEnrollment failed — deny access');
    return false;
  }
}

// Lay thong tin course tu course-service (de lay title, slug)
export async function getCourseById(courseId: string): Promise<{ id: string; title: string; slug: string } | null> {
  try {
    const res = await fetchWithTimeout(`${COURSE_SERVICE_URL}/internal/courses/${courseId}`, {
      headers: { 'x-internal-call': 'true' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    return json?.data ?? null;
  } catch (err) {
    logger.warn({ err, courseId }, '[community-service] getCourseById failed');
    return null;
  }
}

// Lay thong tin auth-service de hien thi ten nguoi dung (batch)
const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://localhost:3101').replace(/\/$/, '');
const userNameCache = new Map<string, { name: string; username: string | null; expiresAt: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 phut

export async function resolveUserNames(
  userIds: string[],
): Promise<Map<string, { name: string; username: string | null }>> {
  const result = new Map<string, { name: string; username: string | null }>();
  const uncachedIds: string[] = [];
  const now = Date.now();

  for (const id of userIds) {
    const cached = userNameCache.get(id);
    if (cached && cached.expiresAt > now) {
      result.set(id, { name: cached.name, username: cached.username });
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length === 0) return result;

  try {
    const res = await fetchWithTimeout(`${AUTH_SERVICE_URL}/internal/users/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-call': 'true' },
      body: JSON.stringify({ userIds: uncachedIds }),
    });
    if (res.ok) {
      const json = (await res.json()) as any;
      const usersMap = json?.data?.users as Record<string, { name: string; username: string | null }> | undefined;
      if (usersMap) {
        for (const [id, info] of Object.entries(usersMap)) {
          result.set(id, info);
          userNameCache.set(id, { ...info, expiresAt: now + USER_CACHE_TTL });
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, '[community-service] resolveUserNames failed — fallback');
  }

  return result;
}

export function getDisplayName(
  userId: string,
  nameMap: Map<string, { name: string; username: string | null }>,
): string {
  const info = nameMap.get(userId);
  return info?.name || info?.username || `Người dùng #${userId.slice(0, 6)}`;
}
