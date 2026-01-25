import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { verifyToken, generateTokenPair } from '../lib/jwt.js';
import { setSession } from '../lib/redis.js';

// Validation schema
const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /refresh
 * Refresh access token using refresh token
 */
export async function refresh(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string;

  try {
    // Validate request body
    const validatedData = refreshSchema.parse(req.body);

    // Verify refresh token
    const jwtSecret = process.env.JWT_SECRET!;
    const payload = verifyToken(validatedData.refreshToken, jwtSecret);

    if (!payload) {
      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: 'Invalid or expired refresh token',
        data: null,
        trace_id: traceId,
      };
      return res.status(401).json(response);
    }

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: validatedData.refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: 'Refresh token not found or revoked',
        data: null,
        trace_id: traceId,
      };
      return res.status(401).json(response);
    }

    // Check if token expired
    if (storedToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: 'Refresh token has expired',
        data: null,
        trace_id: traceId,
      };
      return res.status(401).json(response);
    }

    // Generate new token pair
    const newTokens = generateTokenPair(
      {
        userId: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role,
      },
      jwtSecret
    );

    // Delete old refresh token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Store new refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: newTokens.refreshToken,
        userId: storedToken.user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Update session in Redis
    await setSession(storedToken.user.id, {
      email: storedToken.user.email,
      role: storedToken.user.role,
      refreshedAt: new Date().toISOString(),
    });

    logger.info({ userId: storedToken.user.id }, 'Token refreshed successfully');

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    logger.error({ error, traceId }, 'Token refresh failed');

    // Validation error
    if (error instanceof z.ZodError) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: error.errors[0].message,
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    // Generic error
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error during token refresh',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
