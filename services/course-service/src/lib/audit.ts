import { fetchWithTimeout } from './http';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3101';

export async function writeAuditLog(input: {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  targetLabel?: string | null;
  payload?: unknown;
  traceId?: string;
}) {
  try {
    await fetchWithTimeout(`${AUTH_SERVICE_URL}/internal/audit-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': 'course-service',
        'x-trace-id': input.traceId || '',
      },
      body: JSON.stringify(input),
    });
  } catch {
    // Audit logging should never block category operations.
  }
}