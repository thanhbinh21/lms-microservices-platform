import { fetchWithTimeout } from './http';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3101';

export interface InternalInstructorUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
}

export interface InternalUserSummary {
  name: string;
  username: string | null;
}

export async function fetchInternalInstructors(traceId?: string): Promise<InternalInstructorUser[]> {
  try {
    const response = await fetchWithTimeout(`${AUTH_SERVICE_URL}/internal/instructors`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': 'course-service',
        'x-trace-id': traceId || '',
      },
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as {
      success?: boolean;
      data?: { users?: InternalInstructorUser[] };
    };

    if (!json.success || !json.data?.users) {
      return [];
    }

    return json.data.users.filter((user) => user.role === 'INSTRUCTOR');
  } catch {
    return [];
  }
}

export async function fetchInternalUsersBatch(
  userIds: string[],
  traceId?: string,
): Promise<Record<string, InternalUserSummary>> {
  if (userIds.length === 0) return {};

  try {
    const response = await fetchWithTimeout(`${AUTH_SERVICE_URL}/internal/users/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': 'course-service',
        'x-trace-id': traceId || '',
      },
      body: JSON.stringify({ userIds }),
    });

    if (!response.ok) return {};

    const json = (await response.json()) as {
      success?: boolean;
      data?: { users?: Record<string, InternalUserSummary> };
    };

    if (!json.success || !json.data?.users) return {};

    return json.data.users;
  } catch {
    return {};
  }
}