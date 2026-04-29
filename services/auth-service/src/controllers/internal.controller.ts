import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { logger } from '@lms/logger';

function ensureInternal(req: Request, res: Response): boolean {
  const hdr = (req.headers['x-internal-call'] as string) || '';
  if (!hdr) {
    const response: ApiResponse<null> = {
      success: false,
      code: 403,
      message: 'Internal endpoint',
      data: null,
      trace_id: (req.headers['x-trace-id'] as string) || '',
    };
    res.status(403).json(response);
    return false;
  }
  return true;
}

export const getInternalUser = async (req: Request, res: Response): Promise<Response | void> => {
  if (!ensureInternal(req, res)) return;
  const traceId = (req.headers['x-trace-id'] as string) || '';
  
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
      },
    });

    if (!user) {
      const response: ApiResponse<null> = {
        success: false, code: 404, message: 'User not found', data: null, trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof user> = {
      success: true, code: 200, message: 'OK', data: user, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'getInternalUser error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal server error while fetching user', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};

// Batch lookup: tra ve name + username cho danh sach userId
// Course-service goi de resolve display name trong community posts
export const getInternalUsersBatch = async (req: Request, res: Response): Promise<Response | void> => {
  if (!ensureInternal(req, res)) return;
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const { userIds } = req.body as { userIds?: string[] };

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      const response: ApiResponse<null> = {
        success: false, code: 400, message: 'userIds array is required', data: null, trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    // Gioi han 100 user moi request de tranh query qua lon
    const limitedIds = userIds.slice(0, 100);

    const users = await prisma.user.findMany({
      where: { id: { in: limitedIds } },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
      },
    });

    // Map thanh object { [userId]: { name, username } } de consumer tra cuu nhanh
    const usersMap: Record<string, { name: string; username: string | null; role: string }> = {};
    for (const user of users) {
      usersMap[user.id] = { name: user.name, username: user.username, role: user.role };
    }

    const response: ApiResponse<{ users: typeof usersMap }> = {
      success: true, code: 200, message: 'OK', data: { users: usersMap }, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'getInternalUsersBatch error');
    const response: ApiResponse<null> = {
      success: false, code: 500, message: 'Internal server error while fetching users batch', data: null, trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};
