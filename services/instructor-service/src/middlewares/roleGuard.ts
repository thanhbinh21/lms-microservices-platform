import type { NextFunction, Request, Response } from 'express';
import { errorResponse } from '../utils/apiResponse';

export function roleGuard(allowedRoles: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
    const role = (req.user?.role || '').toUpperCase();
    if (!allowedRoles.includes(role)) {
      errorResponse(res, 'Forbidden: insufficient permissions', 403, traceId);
      return;
    }
    next();
  };
}
