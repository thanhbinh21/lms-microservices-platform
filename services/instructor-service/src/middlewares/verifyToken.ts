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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    errorResponse(res, 'Missing or invalid authorization token', 401, traceId);
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    errorResponse(res, 'Server misconfiguration', 500, traceId);
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtUserPayload;
    if (!decoded.userId || !decoded.role) {
      errorResponse(res, 'Invalid or expired token', 401, traceId);
      return;
    }
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    };
    next();
  } catch {
    errorResponse(res, 'Invalid or expired token', 401, traceId);
  }
}
