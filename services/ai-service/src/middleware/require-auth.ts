import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@lms/types';

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readUserIdFromHeaders(headers: Record<string, string | string[] | undefined>): string {
  const headerId = readHeaderValue(headers['x-user-id']);
  if (headerId) return headerId;

  const auth = readHeaderValue(headers.authorization);
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    const payload = decodeJwtPayload(token);
    if (payload) return (payload.userId as string) || (payload.user_id as string) || '';
  }

  // Fallback: client-side fetch gui cookie thay vi Authorization header.
  const cookieToken = extractTokenFromCookie(headers);
  if (cookieToken) {
    const payload = decodeJwtPayload(cookieToken);
    if (payload) return (payload.userId as string) || (payload.user_id as string) || '';
  }

  return '';
}

function readUserRoleFromHeaders(headers: Record<string, string | string[] | undefined>): string {
  const headerRole = readHeaderValue(headers['x-user-role']);
  if (headerRole) return headerRole;

  const auth = readHeaderValue(headers.authorization);
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    const payload = decodeJwtPayload(token);
    if (payload) return (payload.role as string) || (payload.user_role as string) || '';
  }

  // Fallback: decode tu cookie khi khong co Authorization header.
  const cookieToken = extractTokenFromCookie(headers);
  if (cookieToken) {
    const payload = decodeJwtPayload(cookieToken);
    if (payload) return (payload.role as string) || (payload.user_role as string) || '';
  }

  return '';
}

function extractTokenFromCookie(headers: Record<string, string | string[] | undefined>): string | null {
  const cookie = readHeaderValue(headers.cookie);
  if (!cookie) return null;
  const match = cookie.match(/accessToken=([^;]+)/);
  return match ? match[1].trim() : null;
}

/** Require auth middleware — doc x-user-id tu Gateway headers */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const traceId = readHeaderValue(req.headers['x-trace-id']) || 'unknown';
  const userId = readUserIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

  if (!userId) {
    const response: ApiResponse<null> = {
      success: false,
      code: 401,
      message: 'Unauthorized — missing x-user-id header',
      data: null,
      trace_id: traceId,
    };
    res.status(401).json(response);
    return;
  }

  res.locals.userId = userId;
  res.locals.userRole = readUserRoleFromHeaders(req.headers as Record<string, string | string[] | undefined>);
  next();
}

/** Require internal middleware — doc x-internal-secret */
export function requireInternal(req: Request, res: Response, next: NextFunction): void {
  const traceId = readHeaderValue(req.headers['x-trace-id']) || 'unknown';
  const providedSecret = readHeaderValue(req.headers['x-internal-secret']);

  if (!providedSecret || providedSecret !== process.env.INTERNAL_SERVICE_SECRET) {
    const response: ApiResponse<null> = {
      success: false,
      code: 403,
      message: 'Forbidden — invalid internal secret',
      data: null,
      trace_id: traceId,
    };
    res.status(403).json(response);
    return;
  }

  next();
}
