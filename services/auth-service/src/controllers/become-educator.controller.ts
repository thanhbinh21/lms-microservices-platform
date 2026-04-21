import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { generateTokenPair } from '../lib/jwt.js';
import { setSession } from '../lib/redis.js';
import { getEnv } from '../lib/env.js';

interface BecomeEducatorUser {
  id: string;
  email: string;
  name: string;
  role: 'INSTRUCTOR';
}

interface BecomeEducatorResponseData {
  user: BecomeEducatorUser;
  accessToken: string;
}

const REFRESH_TOKEN_DAYS = 7;

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

/**
 * POST /become-educator
 * Chi cho phep user tu nang cap chinh minh tu STUDENT len INSTRUCTOR.
 */
export async function becomeEducator(req: Request, res: Response) {
  const traceId = readHeaderValue(req.headers['x-trace-id']) || crypto.randomUUID();
  const actorId = readHeaderValue(req.headers['x-user-id']);

  if (!actorId) {
    const response: ApiResponse<null> = {
      success: false,
      code: 401,
      message: 'Unauthorized - missing x-user-id header',
      data: null,
      trace_id: traceId,
    };
    return res.status(401).json(response);
  }

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: actorId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!currentUser) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'User not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (currentUser.role === 'INSTRUCTOR') {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'User is already an instructor',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    if (currentUser.role === 'ADMIN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Admin account cannot use become-educator endpoint',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const upgradedAt = new Date();
    const env = getEnv();
    const nextTokens = generateTokenPair(
      {
        userId: currentUser.id,
        email: currentUser.email,
        role: 'INSTRUCTOR',
      },
      env.JWT_SECRET,
    );

    const refreshTokenExpiry = new Date(upgradedAt);
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + REFRESH_TOKEN_DAYS);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actorId },
        data: {
          role: 'INSTRUCTOR',
        },
      });

      // Dung SQL update de ghi audit timestamp ngay ca khi client chua regenerate type.
      await tx.$executeRaw`
        UPDATE "users"
        SET "became_instructor_at" = ${upgradedAt}
        WHERE "id" = ${actorId}
      `;

      // Thu hoi refresh token cu roi tao token moi de dong bo role trong session tiep theo.
      await tx.refreshToken.deleteMany({
        where: { userId: actorId },
      });

      await tx.refreshToken.create({
        data: {
          token: nextTokens.refreshToken,
          userId: actorId,
          expiresAt: refreshTokenExpiry,
        },
      });
    });

    await setSession(actorId, {
      email: currentUser.email,
      role: 'INSTRUCTOR',
      upgradedAt: upgradedAt.toISOString(),
    });

    logger.info(
      {
        actorId,
        previousRole: currentUser.role,
        newRole: 'INSTRUCTOR',
        traceId,
        timestamp: upgradedAt.toISOString(),
      },
      'Become educator role change audit',
    );

    const response: ApiResponse<BecomeEducatorResponseData> = {
      success: true,
      code: 200,
      message: 'User upgraded to instructor successfully',
      data: {
        user: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          role: 'INSTRUCTOR',
        },
        accessToken: nextTokens.accessToken,
      },
      trace_id: traceId,
    };

    // Gui refresh token moi qua header de Server Action cap nhat lai cookie an toan.
    res.setHeader('x-refresh-token', nextTokens.refreshToken);
    return res.status(200).json(response);
  } catch (error: unknown) {
    logger.error({ error, actorId, traceId }, 'Become educator failed');

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    ) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'User not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while upgrading role',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}