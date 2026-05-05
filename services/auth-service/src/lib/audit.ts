import prisma from './prisma.js';

export interface AuditLogInput {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  targetLabel?: string | null;
  payload?: unknown;
  traceId?: string | null;
}

export async function writeAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      targetLabel: input.targetLabel ?? null,
      payload: input.payload as never,
      traceId: input.traceId ?? null,
    },
  });
}