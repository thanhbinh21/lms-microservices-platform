import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@lms/types';

/**
 * Xac thuc request da qua Kong Gateway (bat buoc co x-user-id header).
 * Gan userId va userRole vao res.locals cho controller phia sau.
 * Service KHONG xac thuc lai JWT — tin tuong header tu Gateway.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined;
  const traceId = (req.headers['x-trace-id'] as string) || '';

  if (!userId) {
    const response: ApiResponse<null> = {
      success: false, code: 401,
      message: 'Unauthorized — missing authentication',
      data: null, trace_id: traceId,
    };
    res.status(401).json(response);
    return;
  }

  res.locals.userId = userId;
  res.locals.userRole = (req.headers['x-user-role'] as string) || '';
  next();
}

/**
 * Yeu cau xac thuc VA kiem tra role.
 * Su dung: app.post('/path', ...requireRole('instructor'), handler)
 */
export function requireRole(...roles: string[]): Array<(req: Request, res: Response, next: NextFunction) => void> {
  return [
    requireAuth,
    (req: Request, res: Response, next: NextFunction): void => {
      const traceId = (req.headers['x-trace-id'] as string) || '';
      if (!roles.includes(res.locals.userRole as string)) {
        const response: ApiResponse<null> = {
          success: false, code: 403,
          message: `Forbidden — required role: ${roles.join(' or ')}`,
          data: null, trace_id: traceId,
        };
        res.status(403).json(response);
        return;
      }
      next();
    },
  ];
}
