import { fetchWithTimeout } from './http';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3101';
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

export interface AuthUserLite {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function fetchUsersByIds(userIds: string[], traceId?: string): Promise<Record<string, AuthUserLite>> {
  if (userIds.length === 0) return {};

  try {
    const response = await fetchWithTimeout(`${AUTH_SERVICE_URL}/internal/users/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': 'payment-service',
        'x-internal-secret': INTERNAL_SERVICE_SECRET,
        'x-trace-id': traceId || '',
      },
      body: JSON.stringify({ userIds: userIds.slice(0, 100) }),
    });

    if (!response.ok) {
      return {};
    }

    const json = (await response.json()) as {
      success?: boolean;
      data?: { users?: Record<string, { id?: string; name?: string; email?: string; role?: string }> };
    };

    if (!json.success || !json.data?.users) {
      return {};
    }

    const result: Record<string, AuthUserLite> = {};
    for (const [id, user] of Object.entries(json.data.users)) {
      result[id] = {
        id: user.id || id,
        name: user.name || user.email || id,
        email: user.email || '',
        role: user.role || '',
      };
    }
    return result;
  } catch {
    return {};
  }
}
