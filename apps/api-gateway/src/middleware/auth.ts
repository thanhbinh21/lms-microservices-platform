import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '@lms/logger';
import type { UserContext } from '@lms/types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/health'];

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth for public routes
  if (PUBLIC_ROUTES.some(route => req.path.startsWith(route))) {
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    logger.warn({ path: req.path, trace_id: (req as any).trace_id }, 'Missing JWT token');
    return res.status(401).json({
      success: false,
      code: 401,
      message: 'Unauthorized - Missing token',
      data: null,
      trace_id: (req as any).trace_id,
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserContext;

    // Attach user to request
    (req as any).user = decoded;

    logger.info(
      {
        user_id: decoded.userId,
        role: decoded.role,
        path: req.path,
        trace_id: (req as any).trace_id,
      },
      'JWT verified successfully'
    );

    next();
  } catch (error) {
    logger.error({ error, trace_id: (req as any).trace_id }, 'JWT verification failed');
    return res.status(401).json({
      success: false,
      code: 401,
      message: 'Unauthorized - Invalid token',
      data: null,
      trace_id: (req as any).trace_id,
    });
  }
};
