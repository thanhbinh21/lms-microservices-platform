import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@lms/types';

// Middleware lay userId tu Kong Gateway header
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined;
  const userRole = req.headers['x-user-role'] as string | undefined;
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
  res.locals.userRole = (userRole || '').toLowerCase();
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
