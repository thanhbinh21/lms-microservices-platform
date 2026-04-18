import { logger } from '@lms/logger';

/**
 * Goi Course Service (noi bo, KHONG qua Kong Gateway) de verify price.
 * Nguyen tac: Payment Service KHONG tin gia do client gui len — luon fetch tu source.
 */

const COURSE_SERVICE_URL = process.env.COURSE_SERVICE_URL || 'http://localhost:3002';

export interface CourseLite {
  id: string;
  title: string;
  slug: string;
  price: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export async function fetchCourseById(
  courseId: string,
  traceId?: string,
): Promise<CourseLite | null> {
  try {
    // course-service khong co endpoint GET by id public; tuy nhien co /api/courses?search...
    // De don gian + giu contract chat, ta goi internal endpoint moi: /internal/courses/:id
    // Neu chua co, fallback dung /api/courses/:slug sau.
    const url = `${COURSE_SERVICE_URL}/internal/courses/${encodeURIComponent(courseId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-trace-id': traceId || '',
        'x-internal-call': 'payment-service',
      },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      logger.warn({ status: res.status, courseId }, 'course-service internal fetch non-OK');
      return null;
    }

    const json = (await res.json()) as { success: boolean; data: CourseLite | null };
    if (!json.success || !json.data) return null;

    return {
      id: json.data.id,
      title: json.data.title,
      slug: json.data.slug,
      price: Number(json.data.price || 0),
      status: json.data.status,
    };
  } catch (err) {
    logger.error({ err, courseId }, 'Loi goi course-service noi bo');
    return null;
  }
}
