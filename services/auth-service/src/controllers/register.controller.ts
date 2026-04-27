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

// Schema dang ky
const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  name: z.string().min(2, 'Tên tối thiểu 2 ký tự'),
});

// Hang so cau hinh
const BCRYPT_SALT_ROUNDS = 10;
const REFRESH_TOKEN_DAYS = 7;

// Sinh username tu email prefix, dam bao unique bang suffix random neu trung
async function generateUniqueUsername(email: string): Promise<string> {
  const prefix = email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 20) || 'user';

  const existing = await withRetry(() => prisma.user.findUnique({
    where: { username: prefix },
    select: { id: true },
  }));

  if (!existing) return prefix;

  // Them suffix random 4 ky tu de tranh trung
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${suffix}`;
}

/** POST /register - Đăng ký tài khoản mới */
export async function register(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);

    // Kiem tra email da ton tai chua
    const existingUser = await withRetry(() => prisma.user.findUnique({
      where: { email: validatedData.email },
    }));

    if (existingUser) {
      const response: ApiResponse<null> = {
        success: false,
        code: 409,
        message: 'Email đã được đăng ký',
        data: null,
        trace_id: traceId,
      };
      return res.status(409).json(response);
    }

    // Ma hoa mat khau
    const hashedPassword = await bcrypt.hash(validatedData.password, BCRYPT_SALT_ROUNDS);

    // Sinh username tu email prefix
    const username = await generateUniqueUsername(validatedData.email);

    // Tao user voi username auto-gen
    const user = await withRetry(() => prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        username,
        role: 'STUDENT',
        sourceType: 'CREDENTIALS',
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        createdAt: true,
      },
    }));

    // Tao cap token JWT
    const env = getEnv();
    const tokens = generateTokenPair(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
    );

    // Luu refresh token vao DB
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + REFRESH_TOKEN_DAYS);

    await withRetry(() => prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    }));

    // Luu session vao Redis
    await setSession(user.id, {
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
    });

    logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

    const response: ApiResponse<{
      user: { id: string; email: string; name: string; username: string | null; role: string };
      accessToken: string;
      refreshToken: string;
    }> = {
      success: true,
      code: 201,
      message: 'Đăng ký thành công',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
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
      message: 'Lỗi hệ thống khi đăng ký',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
