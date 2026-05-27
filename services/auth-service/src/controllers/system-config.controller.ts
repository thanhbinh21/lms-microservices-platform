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

const configValidators: Record<string, (value: unknown) => string | null> = {
  platform_fee_pct: (value) => validateNumber(value, 0, 100),
  instructor_revenue_pct: (value) => validateNumber(value, 0, 100),
  payout_min_amount_vnd: (value) => validateNumber(value, 0, 50_000_000),
  payout_processing_days: (value) => validateNumber(value, 1, 30),
  payout_auto_approve_enabled: validateBoolean,
  payment_provider: (value) => (value === 'VNPAY' ? null : 'payment_provider must be VNPAY'),
  vnpay_enabled: validateBoolean,
  order_pending_minutes: (value) => validateNumber(value, 1, 1440),
  email_notifications_enabled: validateBoolean,
  admin_alert_email: validateOptionalEmail,
  ai_features_enabled: validateBoolean,
  ai_monthly_quota_per_user: (value) => validateNumber(value, 0, 10_000),
  max_login_attempts: (value) => validateNumber(value, 1, 20),
  session_max_age_days: (value) => validateNumber(value, 1, 30),
  admin_ip_allowlist: (value) => (typeof value === 'string' ? null : 'admin_ip_allowlist must be text'),
};

function validateNumber(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Value must be a number';
  if (value < min || value > max) return `Value must be between ${min} and ${max}`;
  return null;
}

function validateBoolean(value: unknown) {
  return typeof value === 'boolean' ? null : 'Value must be true or false';
}

function validateOptionalEmail(value: unknown) {
  if (typeof value !== 'string') return 'Value must be text';
  if (!value.trim()) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : 'Value must be a valid email';
}

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

  const configError = configValidators[parsed.data.key]?.(parsed.data.value);
  if (configError) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: configError,
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
