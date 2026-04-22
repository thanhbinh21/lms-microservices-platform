import { logger } from '@lms/logger';

export interface UserInternalData {
  id: string;
  email: string;
  name: string;
}

export async function getUserData(userId: string): Promise<UserInternalData | null> {
  const baseUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3101';
  try {
    const res = await fetch(`${baseUrl}/internal/users/${userId}`, {
      headers: {
        'x-internal-call': 'true'
      }
    });

    if (!res.ok) {
      logger.warn({ userId, status: res.status }, 'Failed to fetch internal user data');
      return null;
    }

    const data = (await res.json()) as any;
    // Api response la: { success, code, data: { id, email, name } }
    if (data && data.success && data.data) {
        return data.data as UserInternalData;
    }
    return null;
  } catch (err) {
    logger.error({ err, userId }, 'Error fetching internal user data');
    return null;
  }
}
