import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@lms/types';

// Middleware kiem tra user da dang nhap (x-user-id header tu Kong Gateway)
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined;
  const userRole = req.headers['x-user-role'] as string | undefined;
  const traceId = (req.headers['x-trace-id'] as string) || '';

  if (!userId) {
    const response: ApiResponse<null> = {
      success: false,
      code: 401,
      message: 'Unauthorized — vui lòng đăng nhập',
      data: null,
      trace_id: traceId,
    };
    res.status(401).json(response);
    return;
  }

  res.locals.userId = userId;
  res.locals.userRole = userRole || '';
  next();
}
