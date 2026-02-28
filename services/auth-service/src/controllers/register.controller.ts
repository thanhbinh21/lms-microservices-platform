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

// Schema dang ky - ADMIN chi duoc tao boi admin hien tai, khong cho phep tu dang ky
const registerSchema = z.object({
  email: z.string().email('Email khong hop le'),
  password: z.string().min(8, 'Mat khau toi thieu 8 ky tu'),
  name: z.string().min(2, 'Ten toi thieu 2 ky tu'),
  role: z.enum(['STUDENT', 'INSTRUCTOR']).default('STUDENT'),
});

// Hang so cau hinh
const BCRYPT_SALT_ROUNDS = 10;
const REFRESH_TOKEN_DAYS = 7;

/** POST /register - Dang ky tai khoan moi */
export async function register(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      const response: ApiResponse<null> = {
        success: false,
        code: 409,
        message: 'Email already registered',
        data: null,
        trace_id: traceId,
      };
      return res.status(409).json(response);
    }

    // Ma hoa mat khau
    const hashedPassword = await bcrypt.hash(validatedData.password, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        role: validatedData.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Tao cap token JWT
    const env = getEnv();
    const tokens = generateTokenPair(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
    );

    // Luu refresh token vao DB
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + REFRESH_TOKEN_DAYS);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Luu session vao Redis
    await setSession(user.id, {
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
    });

    logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

    const response: ApiResponse<any> = {
      success: true,
      code: 201,
      message: 'User registered successfully',
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

    return res.status(201).json(response);
  } catch (error: any) {
    logger.error({ error, traceId }, 'Registration failed');

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
      message: 'Internal server error during registration',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
