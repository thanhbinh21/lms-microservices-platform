import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  sourceType: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const VALID_ROLES = ['STUDENT', 'INSTRUCTOR', 'ADMIN'] as const;
const VALID_STATUSES = ['ACTIVE', 'BANNED', 'SUSPENDED'] as const;
const BCRYPT_SALT_ROUNDS = 10;

const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Mat khau toi thieu 8 ky tu'),
});

/** GET /admin/users — List users with pagination, search, and filters */
export async function listUsers(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || undefined;
    const role = (req.query.role as string)?.toUpperCase() || undefined;
    const status = (req.query.status as string)?.toUpperCase() || undefined;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role && VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      where.role = role;
    }

    if (status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, traceId }, 'Failed to list users');

    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while listing users',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** GET /admin/users/:id — Get single user detail */
export async function getUser(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'User not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'User retrieved successfully',
      data: user,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, traceId }, 'Failed to get user');

    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while retrieving user',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** PATCH /admin/users/:id/role — Change user role */
export async function updateUserRole(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role.toUpperCase() as (typeof VALID_ROLES)[number])) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const existing = await prisma.user.findUnique({ where: { id } });

    if (!existing) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'User not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (existing.role === 'ADMIN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Cannot modify admin account',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: role.toUpperCase() },
      select: USER_SELECT,
    });

    logger.info({ userId: id, newRole: role.toUpperCase(), adminId: res.locals.userId }, 'User role updated');

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'User role updated successfully',
      data: updated,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, traceId }, 'Failed to update user role');

    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while updating user role',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** PATCH /admin/users/:id/status — Change user status */
export async function updateUserStatus(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status.toUpperCase() as (typeof VALID_STATUSES)[number])) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const existing = await prisma.user.findUnique({ where: { id } });

    if (!existing) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'User not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (existing.role === 'ADMIN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Cannot modify admin account',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: status.toUpperCase() },
      select: USER_SELECT,
    });

    logger.info({ userId: id, newStatus: status.toUpperCase(), adminId: res.locals.userId }, 'User status updated');

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'User status updated successfully',
      data: updated,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, traceId }, 'Failed to update user status');

    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while updating user status',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** PATCH /admin/users/:id/password — Admin sets user password */
export async function updateUserPassword(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const { id } = req.params;
    const validated = updatePasswordSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!existing) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'User not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (existing.role === 'ADMIN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Cannot modify admin account',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const hashedPassword = await bcrypt.hash(validated.password, BCRYPT_SALT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: { id: true },
    });

    logger.info(
      { userId: id, adminId: res.locals.userId },
      'User password updated by admin',
    );

    const response: ApiResponse<{ id: string }> = {
      success: true,
      code: 200,
      message: 'User password updated successfully',
      data: { id },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (error: any) {
    logger.error({ error, traceId }, 'Failed to update user password');

    if (error instanceof z.ZodError) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: error.errors[0]?.message || 'Invalid request',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while updating user password',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** GET /admin/stats — Dashboard summary stats */
export async function getStats(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, usersByRole, newUsersThisMonth, usersByStatus] = await Promise.all([
      prisma.user.count(),

      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),

      prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),

      prisma.user.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const roleMap: Record<string, number> = {};
    for (const entry of usersByRole) {
      roleMap[entry.role] = entry._count.role;
    }

    const statusMap: Record<string, number> = {};
    for (const entry of usersByStatus) {
      statusMap[entry.status] = entry._count.status;
    }

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'Stats retrieved successfully',
      data: {
        totalUsers,
        usersByRole: roleMap,
        newUsersThisMonth,
        usersByStatus: statusMap,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, traceId }, 'Failed to get admin stats');

    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while retrieving stats',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
