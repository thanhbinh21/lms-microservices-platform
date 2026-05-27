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

export async function fetchAdminUsers(traceId?: string): Promise<AuthUserLite[]> {
  try {
    const response = await fetchWithTimeout(`${AUTH_SERVICE_URL}/internal/admins`, {
      headers: {
        'x-internal-call': 'payment-service',
        'x-internal-secret': INTERNAL_SERVICE_SECRET,
        'x-trace-id': traceId || '',
      },
    });

    if (!response.ok) return [];

    const json = (await response.json()) as {
      success?: boolean;
      data?: { users?: AuthUserLite[] };
    };

    return json.success && Array.isArray(json.data?.users) ? json.data.users : [];
  } catch {
    return [];
  }
}

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';

export async function createInternalNotification(input: {
  userId: string;
  title: string;
  body: string;
  eventId: string;
  metadata?: unknown;
  traceId?: string;
}): Promise<void> {
  try {
    await fetchWithTimeout(`${NOTIFICATION_SERVICE_URL}/internal/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': 'payment-service',
        'x-internal-secret': INTERNAL_SERVICE_SECRET,
        'x-trace-id': input.traceId || '',
      },
      body: JSON.stringify({
        userId: input.userId,
        type: 'SYSTEM',
        title: input.title,
        body: input.body,
        metadata: input.metadata || {},
        eventId: input.eventId,
      }),
    });
  } catch {
    // Notification la side effect, khong duoc lam hong flow tien.
  }
}
