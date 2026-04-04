import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';

const updateRoleSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']),
});

export async function updateUserRole(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const validatedData = updateRoleSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: validatedData.userId },
      data: { role: validatedData.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    logger.info({ userId: user.id, role: user.role }, 'User role updated successfully');

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'User role updated successfully',
      data: user,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    logger.error({ error, traceId }, 'Update user role failed');

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

    if (error?.code === 'P2025') {
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
      message: 'Internal server error while updating role',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
