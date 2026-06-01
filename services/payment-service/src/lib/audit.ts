import { fetchWithTimeout } from './http.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3101';
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

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
        'x-internal-call': 'payment-service',
        'x-internal-secret': INTERNAL_SERVICE_SECRET,
        'x-trace-id': input.traceId || '',
      },
      body: JSON.stringify(input),
    });
  } catch {
    // Khong block payment flow neu audit service tam thoi khong reachable.
  }
}
