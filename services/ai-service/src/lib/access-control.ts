/**
 * Access control: kiem tra user co enrolled course khong.
 * Goi learning-service de verify enrollment.
 */
import { fetchWithTimeout } from '../lib/http.js';
import { AI_SERVICE_ENV } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export async function verifyEnrollment(
  userId: string,
  courseId: string,
  traceId: string,
): Promise<boolean> {
  try {
    const url = `${AI_SERVICE_ENV.LEARNING_SERVICE_URL}/internal/enrollment/check?userId=${userId}&courseId=${courseId}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'x-internal-call': 'ai-service',
        'x-internal-secret': AI_SERVICE_ENV.INTERNAL_SERVICE_SECRET,
        'x-trace-id': traceId,
      },
    });

    if (!res.ok) return false;
    const json = (await res.json()) as { data?: { enrolled?: boolean } };
    return Boolean(json?.data?.enrolled);
  } catch (err) {
    logger.warn({ err, userId, courseId }, 'verifyEnrollment error');
    return false;
  }
}
