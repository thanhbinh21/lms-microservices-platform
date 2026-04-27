import crypto from 'node:crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { generateTokenPair } from '../lib/jwt.js';
import { setSession } from '../lib/redis.js';
import { getEnv } from '../lib/env.js';
import { withRetry } from '@lms/db-prisma';

// Schema dang nhap
const loginSchema = z.object({
  email: z.string().email('Email khong hop le'),
  password: z.string().min(1, 'Vui long nhap mat khau'),
});

const REFRESH_TOKEN_DAYS = 7;

/** POST /login - Xac thuc nguoi dung */
export async function login(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);

    // Find user by email
    const user = await withRetry(() => prisma.user.findUnique({
      where: { email: validatedData.email },
      select: {
        id: true, email: true, password: true, name: true, username: true, role: true,
      },
    }));

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

    // Tao cap token JWT
    const env = getEnv();
    const tokens = generateTokenPair(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
    );

    // Luu refresh token vao DB
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + REFRESH_TOKEN_DAYS);

    await withRetry(() => prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      }),
      prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: user.id,
          expiresAt: refreshTokenExpiry,
        },
      })
    ]));

    // Update session in Redis
    await setSession(user.id, {
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in successfully');

    const response: ApiResponse<{
      user: { id: string; email: string; name: string; username: string | null; role: string };
      accessToken: string;
      refreshToken: string;
    }> = {
      success: true,
      code: 200,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username ?? null,
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
