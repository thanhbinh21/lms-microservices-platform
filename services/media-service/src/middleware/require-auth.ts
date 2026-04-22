import { Request, Response, NextFunction } from 'express';
import { ApiResponse, createRequireAuth } from '@lms/types';

export const requireAuth = createRequireAuth() as (req: Request, res: Response, next: NextFunction) => void;

/**
 * Yeu cau xac thuc VA kiem tra role.
 * Su dung: app.post('/path', ...requireRole('instructor'), handler)
 */
export function requireRole(...roles: string[]): Array<(req: Request, res: Response, next: NextFunction) => void> {
  return [
    requireAuth,
    (req: Request, res: Response, next: NextFunction): void => {
      const traceId = (req.headers['x-trace-id'] as string) || '';
      const userRole = ((res.locals.userRole as string) || '').toLowerCase();
      if (!roles.some((r) => r.toLowerCase() === userRole)) {
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
