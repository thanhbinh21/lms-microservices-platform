import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { logger } from '@lms/logger';
import { writeAuditLog } from '../lib/audit.js';

const updateConfigSchema = z.object({
  key: z.string().min(2).max(100),
  value: z.unknown(),
  description: z.string().max(500).optional(),
});

export async function listSystemConfigs(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  try {
    const items = await prisma.systemConfig.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    const response: ApiResponse<typeof items> = {
      success: true,
      code: 200,
      message: 'System configs retrieved successfully',
      data: items,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, traceId }, 'Failed to list system configs');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while listing system configs',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

export async function upsertSystemConfig(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const parsed = updateConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsed.error.issues[0]?.message || 'Invalid payload',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const existing = await prisma.systemConfig.findUnique({ where: { key: parsed.data.key } });
    const updated = await prisma.systemConfig.upsert({
      where: { key: parsed.data.key },
      create: {
        key: parsed.data.key,
        value: parsed.data.value as never,
        description: parsed.data.description ?? null,
        updatedBy: res.locals.userId,
      },
      update: {
        value: parsed.data.value as never,
        description: parsed.data.description ?? null,
        updatedBy: res.locals.userId,
      },
    });

    await writeAuditLog({
      actorId: res.locals.userId,
      actorRole: 'ADMIN',
      action: existing ? 'SYSTEM_CONFIG_UPDATED' : 'SYSTEM_CONFIG_CREATED',
      resourceType: 'SYSTEM_CONFIG',
      resourceId: updated.id,
      targetLabel: updated.key,
      payload: {
        previousValue: existing?.value ?? null,
        nextValue: updated.value,
      },
      traceId,
    });

    const response: ApiResponse<typeof updated> = {
      success: true,
      code: 200,
      message: 'System config saved',
      data: updated,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, traceId }, 'Failed to save system config');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while saving system config',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
