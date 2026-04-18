import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@lms/types';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined;
  const userRole = (req.headers['x-user-role'] as string || '').toUpperCase();
  const traceId = (req.headers['x-trace-id'] as string) || '';

  if (!userId) {
    const response: ApiResponse<null> = {
      success: false,
      code: 401,
      message: 'Unauthorized — missing authentication',
      data: null,
      trace_id: traceId,
    };
    res.status(401).json(response);
    return;
  }

  if (userRole !== 'ADMIN') {
    const response: ApiResponse<null> = {
      success: false,
      code: 403,
      message: 'Forbidden — admin access required',
      data: null,
      trace_id: traceId,
    };
    res.status(403).json(response);
    return;
  }

  res.locals.userId = userId;
  res.locals.userRole = userRole;
  next();
}
