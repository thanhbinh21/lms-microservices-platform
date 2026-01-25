import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { generateTokenPair } from '../lib/jwt.js';
import { setSession } from '../lib/redis.js';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /login
 * Authenticate existing user
 */
export async function login(req: Request, res: Response) {
  const traceId = req.headers['x-trace-id'] as string;

  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: 'Invalid email or password',
        data: null,
        trace_id: traceId,
      };
      return res.status(401).json(response);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);

    if (!isPasswordValid) {
      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: 'Invalid email or password',
        data: null,
        trace_id: traceId,
      };
      return res.status(401).json(response);
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET!;
    const tokens = generateTokenPair(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret
    );

    // Store refresh token in database
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Update session in Redis
    await setSession(user.id, {
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in successfully');

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    logger.error({ error, traceId }, 'Login failed');

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
      message: 'Internal server error during login',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
