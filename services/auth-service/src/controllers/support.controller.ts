import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { writeAuditLog } from '../lib/audit.js';

const TICKET_SELECT = {
  id: true,
  userId: true,
  subject: true,
  description: true,
  category: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  replies: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      ticketId: true,
      authorId: true,
      authorRole: true,
      message: true,
      createdAt: true,
    },
  },
} as const;

const createTicketSchema = z.object({
  subject: z.string().trim().min(6, 'Tieu de can it nhat 6 ky tu').max(160),
  description: z.string().trim().min(10, 'Noi dung can it nhat 10 ky tu').max(5000),
  category: z.enum(['PAYMENT', 'COURSE', 'ACCOUNT', 'SYSTEM', 'OTHER']).default('OTHER'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
});

const replySchema = z.object({
  message: z.string().trim().min(2, 'Noi dung phan hoi can it nhat 2 ky tu').max(5000),
});

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  category: z.enum(['PAYMENT', 'COURSE', 'ACCOUNT', 'SYSTEM', 'OTHER']).optional(),
  search: z.string().trim().optional(),
});

function traceId(req: Request): string {
  const value = req.headers['x-trace-id'];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function apiError<T = null>(res: Response, code: number, message: string, requestTraceId: string, data: T | null = null) {
  const response: ApiResponse<T> = {
    success: false,
    code,
    message,
    data,
    trace_id: requestTraceId,
  };
  return res.status(code).json(response);
}

async function fetchUsers(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, { id: string; name: string | null; email: string; role: string }>();

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, email: true, role: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

function enrichTicket(ticket: any, userMap: Map<string, { id: string; name: string | null; email: string; role: string }>) {
  const owner = userMap.get(ticket.userId) || null;
  return {
    ...ticket,
    userName: owner?.name || null,
    userEmail: owner?.email || null,
    replies: (ticket.replies || []).map((reply: any) => {
      const author = userMap.get(reply.authorId) || null;
      return {
        ...reply,
        authorName: author?.name || null,
        authorEmail: author?.email || null,
      };
    }),
  };
}

export async function createSupportTicket(req: Request, res: Response) {
  const requestTraceId = traceId(req);
  const userId = res.locals.userId as string;
  const parsed = createTicketSchema.safeParse(req.body);

  if (!parsed.success) {
    return apiError(res, 400, parsed.error.issues[0]?.message || 'Du lieu khong hop le', requestTraceId);
  }

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject: parsed.data.subject,
        description: parsed.data.description,
        category: parsed.data.category,
        priority: parsed.data.priority,
      },
      select: TICKET_SELECT,
    });

    const userMap = await fetchUsers([ticket.userId]);
    const response: ApiResponse<ReturnType<typeof enrichTicket>> = {
      success: true,
      code: 201,
      message: 'Da gui yeu cau ho tro',
      data: enrichTicket(ticket, userMap),
      trace_id: requestTraceId,
    };
    return res.status(201).json(response);
  } catch (error) {
    logger.error({ error, requestTraceId, userId }, 'createSupportTicket failed');
    return apiError(res, 500, 'Khong the tao yeu cau ho tro', requestTraceId);
  }
}

export async function listMySupportTickets(req: Request, res: Response) {
  const requestTraceId = traceId(req);
  const userId = res.locals.userId as string;

  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: TICKET_SELECT,
    });
    const userMap = await fetchUsers([userId, ...tickets.flatMap((ticket) => ticket.replies.map((reply) => reply.authorId))]);
    const response: ApiResponse<Array<ReturnType<typeof enrichTicket>>> = {
      success: true,
      code: 200,
      message: 'Support tickets fetched',
      data: tickets.map((ticket) => enrichTicket(ticket, userMap)),
      trace_id: requestTraceId,
    };
    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, requestTraceId, userId }, 'listMySupportTickets failed');
    return apiError(res, 500, 'Khong the tai danh sach ho tro', requestTraceId);
  }
}

export async function getSupportTicket(req: Request, res: Response) {
  const requestTraceId = traceId(req);
  const userId = res.locals.userId as string;
  const role = String(res.locals.userRole || '').toUpperCase();

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      select: TICKET_SELECT,
    });
    if (!ticket) return apiError(res, 404, 'Khong tim thay yeu cau ho tro', requestTraceId);
    if (ticket.userId !== userId && role !== 'ADMIN') {
      return apiError(res, 403, 'Ban khong co quyen xem yeu cau nay', requestTraceId);
    }

    const userMap = await fetchUsers([ticket.userId, ...ticket.replies.map((reply) => reply.authorId)]);
    const response: ApiResponse<ReturnType<typeof enrichTicket>> = {
      success: true,
      code: 200,
      message: 'Support ticket fetched',
      data: enrichTicket(ticket, userMap),
      trace_id: requestTraceId,
    };
    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, requestTraceId, userId, ticketId: req.params.id }, 'getSupportTicket failed');
    return apiError(res, 500, 'Khong the tai yeu cau ho tro', requestTraceId);
  }
}

export async function replySupportTicket(req: Request, res: Response) {
  const requestTraceId = traceId(req);
  const userId = res.locals.userId as string;
  const role = String(res.locals.userRole || '').toUpperCase() || 'STUDENT';
  const parsed = replySchema.safeParse(req.body);

  if (!parsed.success) {
    return apiError(res, 400, parsed.error.issues[0]?.message || 'Du lieu khong hop le', requestTraceId);
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return apiError(res, 404, 'Khong tim thay yeu cau ho tro', requestTraceId);
    if (ticket.userId !== userId && role !== 'ADMIN') {
      return apiError(res, 403, 'Ban khong co quyen phan hoi yeu cau nay', requestTraceId);
    }
    if (ticket.status === 'CLOSED') {
      return apiError(res, 409, 'Yeu cau da dong, khong the phan hoi them', requestTraceId);
    }

    const [reply, updated] = await prisma.$transaction([
      prisma.supportTicketReply.create({
        data: {
          ticketId: ticket.id,
          authorId: userId,
          authorRole: role,
          message: parsed.data.message,
        },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: role === 'ADMIN' && ticket.status === 'OPEN' ? { status: 'IN_PROGRESS' } : {},
        select: TICKET_SELECT,
      }),
    ]);

    if (role === 'ADMIN') {
      await writeAuditLog({
        actorId: userId,
        actorRole: 'ADMIN',
        action: 'SUPPORT_TICKET_REPLIED',
        resourceType: 'SUPPORT_TICKET',
        resourceId: ticket.id,
        targetLabel: ticket.subject,
        payload: { replyId: reply.id },
        traceId: requestTraceId,
      });
    }

    const userMap = await fetchUsers([updated.userId, ...updated.replies.map((item) => item.authorId)]);
    const response: ApiResponse<ReturnType<typeof enrichTicket>> = {
      success: true,
      code: 201,
      message: 'Da gui phan hoi',
      data: enrichTicket(updated, userMap),
      trace_id: requestTraceId,
    };
    return res.status(201).json(response);
  } catch (error) {
    logger.error({ error, requestTraceId, userId, ticketId: req.params.id }, 'replySupportTicket failed');
    return apiError(res, 500, 'Khong the gui phan hoi', requestTraceId);
  }
}

export async function listAdminSupportTickets(req: Request, res: Response) {
  const requestTraceId = traceId(req);
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return apiError(res, 400, parsed.error.issues[0]?.message || 'Query khong hop le', requestTraceId);
  }

  try {
    const { page, limit, status, category, search } = parsed.data;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: TICKET_SELECT,
      }),
      prisma.supportTicket.count({ where }),
    ]);
    const userMap = await fetchUsers([...items.map((ticket) => ticket.userId), ...items.flatMap((ticket) => ticket.replies.map((reply) => reply.authorId))]);
    const response: ApiResponse<{
      items: Array<ReturnType<typeof enrichTicket>>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> = {
      success: true,
      code: 200,
      message: 'Support tickets fetched',
      data: {
        items: items.map((ticket) => enrichTicket(ticket, userMap)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      trace_id: requestTraceId,
    };
    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, requestTraceId }, 'listAdminSupportTickets failed');
    return apiError(res, 500, 'Khong the tai danh sach ho tro', requestTraceId);
  }
}

export async function updateAdminSupportTicket(req: Request, res: Response) {
  const requestTraceId = traceId(req);
  const adminId = res.locals.userId as string;
  const parsed = updateTicketSchema.safeParse(req.body);

  if (!parsed.success) {
    return apiError(res, 400, parsed.error.issues[0]?.message || 'Du lieu khong hop le', requestTraceId);
  }

  try {
    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!existing) return apiError(res, 404, 'Khong tim thay yeu cau ho tro', requestTraceId);

    const status = parsed.data.status;
    const closedAt = status === 'CLOSED' ? new Date() : status ? null : existing.closedAt;
    const ticket = await prisma.supportTicket.update({
      where: { id: existing.id },
      data: {
        status: status ?? existing.status,
        priority: parsed.data.priority ?? existing.priority,
        closedAt,
      },
      select: TICKET_SELECT,
    });

    await writeAuditLog({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'SUPPORT_TICKET_UPDATED',
      resourceType: 'SUPPORT_TICKET',
      resourceId: ticket.id,
      targetLabel: ticket.subject,
      payload: { before: existing, after: ticket },
      traceId: requestTraceId,
    });

    const userMap = await fetchUsers([ticket.userId, ...ticket.replies.map((reply) => reply.authorId)]);
    const response: ApiResponse<ReturnType<typeof enrichTicket>> = {
      success: true,
      code: 200,
      message: 'Support ticket updated',
      data: enrichTicket(ticket, userMap),
      trace_id: requestTraceId,
    };
    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error, requestTraceId, ticketId: req.params.id }, 'updateAdminSupportTicket failed');
    return apiError(res, 500, 'Khong the cap nhat yeu cau ho tro', requestTraceId);
  }
}
