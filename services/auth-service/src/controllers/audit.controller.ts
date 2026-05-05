import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { logger } from '@lms/logger';
import { writeAuditLog } from '../lib/audit.js';

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

function ensureInternal(req: Request, res: Response): boolean {
  const internal = readHeaderValue(req.headers['x-internal-call']);
  if (!internal) {
    const response: ApiResponse<null> = {
      success: false,
      code: 403,
      message: 'Internal endpoint',
      data: null,
      trace_id: readHeaderValue(req.headers['x-trace-id']),
    };
    res.status(403).json(response);
    return false;
  }
  return true;
}

export async function listAuditLogs(req: Request, res: Response) {
  const traceId = readHeaderValue(req.headers['x-trace-id']) || '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const action = readHeaderValue(req.query.action as string | string[] | undefined).trim();
  const resourceType = readHeaderValue(req.query.resourceType as string | string[] | undefined).trim();
  const actorId = readHeaderValue(req.query.actorId as string | string[] | undefined).trim();

  try {
    const where: Record<string, unknown> = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (resourceType) where.resourceType = { contains: resourceType, mode: 'insensitive' };
    if (actorId) where.actorId = actorId;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const actorIds = [...new Set(items.map((item) => item.actorId))];
    const actors = actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];

    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    const response: ApiResponse<{
      items: Array<
        (typeof items)[number] & {
          actorName: string | null;
          actorEmail: string | null;
        }
      >;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> = {
      success: true,
      code: 200,
      message: 'Audit logs fetched',
      data: {
        items: items.map((item) => {
          const actor = actorMap.get(item.actorId) || null;
          return {
            ...item,
            actorName: actor?.name || null,
            actorEmail: actor?.email || null,
          };
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'listAuditLogs error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while listing audit logs',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

export async function createAuditLog(req: Request, res: Response) {
  if (!ensureInternal(req, res)) return;
  const traceId = readHeaderValue(req.headers['x-trace-id']) || '';

  try {
    const body = req.body as {
      actorId?: string;
      actorRole?: string;
      action?: string;
      resourceType?: string | null;
      resourceId?: string | null;
      targetLabel?: string | null;
      payload?: unknown;
    };

    if (!body.actorId || !body.actorRole || !body.action) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'actorId, actorRole, action are required',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const log = await writeAuditLog({
      actorId: body.actorId,
      actorRole: body.actorRole,
      action: body.action,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      targetLabel: body.targetLabel,
      payload: body.payload,
      traceId,
    });

    const response: ApiResponse<typeof log> = {
      success: true,
      code: 201,
      message: 'Audit log created',
      data: log,
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (error) {
    logger.error({ error }, 'createAuditLog error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal server error while creating audit log',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}