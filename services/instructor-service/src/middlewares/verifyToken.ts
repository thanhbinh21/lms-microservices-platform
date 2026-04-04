import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/apiResponse';

interface JwtUserPayload extends jwt.JwtPayload {
  userId: string;
  role: string;
  email?: string;
}

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
  const userId = req.headers['x-user-id'] as string | undefined;
  const userRole = req.headers['x-user-role'] as string | undefined;

  if (!userId) {
    errorResponse(res, 'Unauthorized — missing authentication', 401, traceId);
    return;
  }

  req.user = {
    userId: userId,
    role: userRole || '',
    // Kong mặc định không truyền email via headers, nên ta bỏ qua hoặc map từ decode middleware nếu có
  };
  
  next();
}
