import { Request, Response } from 'express';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { verifyToken } from '../lib/jwt.js';
import { deleteSession } from '../lib/redis.js';

/**
 * POST /logout
 * Invalidate session and tokens
 * Requires Authorization header with Bearer token
 */
export async function logout(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string;

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: 'Missing or invalid Authorization header',
        data: null,
        trace_id: traceId,
      };
      return res.status(401).json(response);
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const jwtSecret = process.env.JWT_SECRET!;
    const payload = verifyToken(token, jwtSecret);

    if (!payload) {
      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: 'Invalid or expired token',
        data: null,
        trace_id: traceId,
      };
      return res.status(401).json(response);
    }

    // Delete all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId: payload.userId },
    });

    // Delete session from Redis
    await deleteSession(payload.userId);

    logger.info({ userId: payload.userId }, 'User logged out successfully');

    const response: ApiResponse<null> = {
      success: true,
      code: 200,
      message: 'Logout successful',
      data: null,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    logger.error({ error, traceId }, 'Logout failed');

    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error during logout',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
