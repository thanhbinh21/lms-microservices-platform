import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@lms/types';

/**
 * Xac thuc request tu Kong Gateway (bat buoc co x-user-id header).
 * Service KHONG xac thuc lai JWT - tin tuong header tu Gateway.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined;
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

  res.locals.userId = userId;
  res.locals.userRole = (req.headers['x-user-role'] as string) || '';
  next();
}
