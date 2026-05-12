import { Router, type Router as ExpressRouter, Request, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma.js';
import { resolveUserNames, getDisplayName } from '../lib/clients.js';

export const qaRouter: ExpressRouter = Router();

// Schemas
const createQuestionSchema = z.object({
  title: z.string().trim().min(6).max(200),
  content: z.string().trim().min(10).max(5000),
  courseId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
});

const createAnswerSchema = z.object({
  content: z.string().trim().min(2).max(5000),
});

const updateQuestionSchema = z.object({
  title: z.string().trim().min(6).max(200).optional(),
  content: z.string().trim().min(10).max(5000).optional(),
});

const updateAnswerSchema = z.object({
  content: z.string().trim().min(2).max(5000),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  status: z.enum(['all', 'unanswered', 'resolved']).default('all'),
  sortBy: z.enum(['recent', 'popular', 'upvotes']).default('recent'),
  courseId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

function requireAuth(req: Request, res: Response, next: Function): void {
  if (!res.locals.userId) {
    res.status(401).json({ success: false, code: 401, message: 'Unauthorized', data: null, trace_id: '' });
    return;
  }
  next();
}

function isAdmin(role?: string): boolean {
  return (role || '').toUpperCase() === 'ADMIN';
}

// ─── POST /api/qa/questions ──────────────────────────────────────────────────

qaRouter.post('/questions', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;

  try {
    const payload = createQuestionSchema.parse(req.body ?? {});
    const created = await prisma.question.create({
      data: {
        authorId: userId,
        title: payload.title,
        content: payload.content,
        courseId: payload.courseId || null,
        lessonId: payload.lessonId || null,
      },
    });
    const response: ApiResponse<typeof created> = {
      success: true, code: 201, message: 'Question created', data: created, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    }
    logger.error({ err, userId, traceId }, 'createQuestion failed');
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── GET /api/qa/questions ───────────────────────────────────────────────────

qaRouter.get('/questions', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const query = listQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;
    const where: any = {};
    if (query.courseId) where.courseId = query.courseId;
    if (query.status === 'resolved') where.isResolved = true;
    if (query.status === 'unanswered') where.answers = { none: {} };
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const orderBy: any =
      query.sortBy === 'popular' ? [{ viewCount: 'desc' }, { createdAt: 'desc' }]
        : query.sortBy === 'upvotes' ? [{ upvoteCount: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];

    const [items, total] = await prisma.$transaction([
      prisma.question.findMany({
        where,
        skip,
        take: query.limit,
        orderBy,
        include: { _count: { select: { answers: true } } },
      }),
      prisma.question.count({ where }),
    ]);

    const authorIds = [...new Set(items.map((i) => i.authorId))];
    const nameMap = await resolveUserNames(authorIds);

    const response: ApiResponse<any> = {
      success: true, code: 200, message: 'Questions fetched',
      data: {
        items: items.map((q) => ({
          ...q,
          author: { id: q.authorId, displayName: getDisplayName(q.authorId, nameMap) },
          answerCount: q._count.answers,
        })),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'listQuestions failed');
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── GET /api/qa/questions/:id ───────────────────────────────────────────────

qaRouter.get('/questions/:id', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const viewerId = (res.locals.userId as string) || '';

  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: {
        answers: {
          orderBy: [{ isAccepted: 'desc' }, { upvoteCount: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!question) {
      return res.status(404).json({ success: false, code: 404, message: 'Question not found', data: null, trace_id: traceId });
    }

    await prisma.question.update({ where: { id: question.id }, data: { viewCount: { increment: 1 } } });

    const userIds = [question.authorId, ...question.answers.map((a) => a.authorId)];
    const nameMap = await resolveUserNames(userIds);

    const [votedQuestion, votedAnswerRows] = await Promise.all([
      viewerId ? prisma.questionUpvote.findUnique({ where: { questionId_userId: { questionId: question.id, userId: viewerId } } }) : null,
      viewerId ? prisma.answerUpvote.findMany({ where: { userId: viewerId, answerId: { in: question.answers.map((a) => a.id) } }, select: { answerId: true } }) : [],
    ]);
    const votedSet = new Set(votedAnswerRows.map((v) => v.answerId));

    const response: ApiResponse<any> = {
      success: true, code: 200, message: 'Question detail',
      data: {
        ...question,
        author: { id: question.authorId, displayName: getDisplayName(question.authorId, nameMap) },
        upvotedByMe: Boolean(votedQuestion),
        answers: question.answers.map((a) => ({
          ...a,
          author: { id: a.authorId, displayName: getDisplayName(a.authorId, nameMap) },
          upvotedByMe: votedSet.has(a.id),
        })),
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'getQuestionDetail failed');
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── PUT/DELETE /api/qa/questions/:id ────────────────────────────────────────

qaRouter.put('/questions/:id', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const role = res.locals.userRole as string;

  try {
    const payload = updateQuestionSchema.parse(req.body ?? {});
    const q = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!q) return res.status(404).json({ success: false, code: 404, message: 'Not found', data: null, trace_id: traceId });
    if (q.authorId !== userId && !isAdmin(role)) {
      return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId });
    }
    const updated = await prisma.question.update({
      where: { id: req.params.id },
      data: { title: payload.title ?? q.title, content: payload.content ?? q.content },
    });
    return res.status(200).json({ success: true, code: 200, message: 'Updated', data: updated, trace_id: traceId });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

qaRouter.delete('/questions/:id', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const role = res.locals.userRole as string;

  try {
    const q = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!q) return res.status(404).json({ success: false, code: 404, message: 'Not found', data: null, trace_id: traceId });
    if (q.authorId !== userId && !isAdmin(role)) {
      return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId });
    }
    await prisma.question.delete({ where: { id: req.params.id } });
    return res.status(200).json({ success: true, code: 200, message: 'Deleted', data: null, trace_id: traceId });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── POST /api/qa/questions/:id/answers ──────────────────────────────────────

qaRouter.post('/questions/:id/answers', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;

  try {
    const payload = createAnswerSchema.parse(req.body ?? {});
    const q = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!q) return res.status(404).json({ success: false, code: 404, message: 'Not found', data: null, trace_id: traceId });

    const answer = await prisma.answer.create({ data: { questionId: req.params.id, authorId: userId, content: payload.content } });
    return res.status(201).json({ success: true, code: 201, message: 'Answer created', data: answer, trace_id: traceId });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── PUT /api/qa/questions/:id/answers/:answerId/accept ──────────────────────

qaRouter.put('/questions/:id/answers/:answerId/accept', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { id: questionId, answerId } = req.params;

  try {
    const q = await prisma.question.findUnique({ where: { id: questionId } });
    if (!q) return res.status(404).json({ success: false, code: 404, message: 'Not found', data: null, trace_id: traceId });
    if (q.authorId !== userId) return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId });

    await prisma.$transaction([
      prisma.answer.updateMany({ where: { questionId }, data: { isAccepted: false } }),
      prisma.answer.update({ where: { id: answerId }, data: { isAccepted: true } }),
      prisma.question.update({ where: { id: questionId }, data: { isResolved: true } }),
    ]);
    return res.status(200).json({ success: true, code: 200, message: 'Answer accepted', data: { answerId }, trace_id: traceId });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── POST /api/qa/questions/:id/upvote ───────────────────────────────────────

qaRouter.post('/questions/:id/upvote', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const questionId = req.params.id;

  try {
    const existing = await prisma.questionUpvote.findUnique({ where: { questionId_userId: { questionId, userId } } });
    if (existing) {
      await prisma.$transaction([
        prisma.questionUpvote.delete({ where: { id: existing.id } }),
        prisma.question.update({ where: { id: questionId }, data: { upvoteCount: { decrement: 1 } } }),
      ]);
      return res.status(200).json({ success: true, code: 200, message: 'Unvoted', data: { upvoted: false }, trace_id: traceId });
    }
    await prisma.$transaction([
      prisma.questionUpvote.create({ data: { questionId, userId } }),
      prisma.question.update({ where: { id: questionId }, data: { upvoteCount: { increment: 1 } } }),
    ]);
    return res.status(200).json({ success: true, code: 200, message: 'Upvoted', data: { upvoted: true }, trace_id: traceId });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── POST /api/qa/answers/:id/upvote ─────────────────────────────────────────

qaRouter.post('/answers/:id/upvote', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const answerId = req.params.id;

  try {
    const existing = await prisma.answerUpvote.findUnique({ where: { answerId_userId: { answerId, userId } } });
    if (existing) {
      await prisma.$transaction([
        prisma.answerUpvote.delete({ where: { id: existing.id } }),
        prisma.answer.update({ where: { id: answerId }, data: { upvoteCount: { decrement: 1 } } }),
      ]);
      return res.status(200).json({ success: true, code: 200, message: 'Unvoted', data: { upvoted: false }, trace_id: traceId });
    }
    await prisma.$transaction([
      prisma.answerUpvote.create({ data: { answerId, userId } }),
      prisma.answer.update({ where: { id: answerId }, data: { upvoteCount: { increment: 1 } } }),
    ]);
    return res.status(200).json({ success: true, code: 200, message: 'Upvoted', data: { upvoted: true }, trace_id: traceId });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── PUT /api/qa/answers/:id ───────────────────────────────────────────────

qaRouter.put('/answers/:id', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const role = res.locals.userRole as string;
  const answerId = req.params.id;

  try {
    const payload = updateAnswerSchema.parse(req.body ?? {});
    const answer = await prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer) {
      return res.status(404).json({ success: false, code: 404, message: 'Not found', data: null, trace_id: traceId });
    }
    if (answer.authorId !== userId && !isAdmin(role)) {
      return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId });
    }

    const updated = await prisma.answer.update({
      where: { id: answerId },
      data: { content: payload.content },
    });

    return res.status(200).json({ success: true, code: 200, message: 'Updated', data: updated, trace_id: traceId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    }
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── DELETE /api/qa/answers/:id ─────────────────────────────────────────────

qaRouter.delete('/answers/:id', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const role = res.locals.userRole as string;
  const answerId = req.params.id;

  try {
    const answer = await prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer) {
      return res.status(404).json({ success: false, code: 404, message: 'Not found', data: null, trace_id: traceId });
    }
    if (answer.authorId !== userId && !isAdmin(role)) {
      return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId });
    }

    await prisma.answer.delete({ where: { id: answerId } });
    return res.status(200).json({ success: true, code: 200, message: 'Deleted', data: null, trace_id: traceId });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});
