import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@lms/types';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    return typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function resolveUserFromHeaders(req: Request): { userId: string; userRole: string } {
  const gatewayUserId = req.headers['x-user-id'] as string | undefined;
  const gatewayUserRole = req.headers['x-user-role'] as string | undefined;
  if (gatewayUserId) {
    return { userId: gatewayUserId, userRole: (gatewayUserRole || '').toLowerCase() };
  }

  const authorization = (req.headers.authorization || '').trim();
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return { userId: '', userRole: '' };
  }

  const payload = decodeJwtPayload(authorization.slice(7).trim());
  if (!payload) {
    return { userId: '', userRole: '' };
  }

  return {
    userId: typeof payload.userId === 'string' ? payload.userId : '',
    userRole: typeof payload.role === 'string' ? payload.role.toLowerCase() : '',
  };
}

// Middleware lay userId tu Kong Gateway header
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { userId, userRole } = resolveUserFromHeaders(req);
  const traceId = (req.headers['x-trace-id'] as string) || '';

  if (!userId) {
    const response: ApiResponse<null> = {
      success: false,
      code: 401,
      message: 'Unauthorized',
      data: null,
      trace_id: traceId,
    };
    res.status(401).json(response);
    return;
  }

  res.locals.userId = userId;
  res.locals.userRole = userRole;
  next();
}

export function requireRole(...roles: string[]) {
  return [
    requireAuth,
    (req: Request, res: Response, next: NextFunction): void => {
      const userRole = (res.locals.userRole as string || '').toLowerCase();
      const traceId = (req.headers['x-trace-id'] as string) || '';
      if (!roles.map(r => r.toLowerCase()).includes(userRole)) {
        const response: ApiResponse<null> = {
          success: false,
          code: 403,
          message: 'Forbidden',
          data: null,
          trace_id: traceId,
        };
        res.status(403).json(response);
        return;
      }
      next();
    },
  ];
}
