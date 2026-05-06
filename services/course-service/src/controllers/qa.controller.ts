import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import { getDisplayName, getUserRole, resolveUserNames } from '../lib/community';
const db = prisma as any;

const createQuestionSchema = z.object({
  title: z.string().trim().min(6).max(200),
  content: z.string().trim().min(10).max(5000),
  courseId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
});

const updateQuestionSchema = z.object({
  title: z.string().trim().min(6).max(200).optional(),
  content: z.string().trim().min(10).max(5000).optional(),
});

const createAnswerSchema = z.object({
  content: z.string().trim().min(2).max(5000),
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

function isAdmin(role?: string): boolean {
  return (role || '').toUpperCase() === 'ADMIN';
}

function mapAuthor(userId: string, nameMap: Map<string, any>, slugMap: Map<string, string>) {
  const role = getUserRole(userId, nameMap as any);
  return {
    id: userId,
    displayName: getDisplayName(userId, nameMap as any),
    role,
    instructorSlug: role.toUpperCase() === 'INSTRUCTOR' ? (slugMap.get(userId) || null) : null,
  };
}

async function resolveAuthorContext(userIds: string[]) {
  const unique = [...new Set(userIds)];
  const nameMap = await resolveUserNames(unique);
  const instructorIds = unique.filter((id) => getUserRole(id, nameMap).toUpperCase() === 'INSTRUCTOR');
  const profiles = instructorIds.length
      ? await db.instructorProfile.findMany({
        where: { instructorId: { in: instructorIds } },
        select: { instructorId: true, slug: true },
      })
    : [];
  return { nameMap, slugMap: new Map<string, string>(profiles.map((p: any) => [p.instructorId, p.slug])) };
}

export async function createQuestion(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const userId = res.locals.userId as string;
    const payload = createQuestionSchema.parse(req.body ?? {});
    const created = await db.question.create({
      data: {
        userId,
        title: payload.title,
        content: payload.content,
        courseId: payload.courseId || null,
        lessonId: payload.lessonId || null,
      },
    });
    const response: ApiResponse<typeof created> = { success: true, code: 201, message: 'Question created', data: created, trace_id: traceId };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = { success: false, code: 400, message: err.errors[0]?.message || 'Invalid payload', data: null, trace_id: traceId };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'createQuestion');
  }
}

export async function listQuestions(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const query = listQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;
    const where: any = {};
    if (query.courseId) where.courseId = query.courseId;
    if (query.status === 'resolved') where.isResolved = true;
    if (query.status === 'unanswered') where.answers = { none: {} };
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };
    const orderBy =
      query.sortBy === 'popular'
        ? [{ viewCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : query.sortBy === 'upvotes'
          ? [{ upvoteCount: 'desc' as const }, { createdAt: 'desc' as const }]
          : [{ createdAt: 'desc' as const }];

    const [items, total] = await db.$transaction([
      db.question.findMany({
        where,
        skip,
        take: query.limit,
        orderBy,
        select: {
          id: true, userId: true, title: true, content: true, courseId: true, isResolved: true, viewCount: true, upvoteCount: true, createdAt: true, updatedAt: true,
          course: { select: { id: true, title: true, slug: true } },
          _count: { select: { answers: true } },
        },
      }),
      db.question.count({ where }),
    ]);
    const { nameMap, slugMap } = await resolveAuthorContext(items.map((i: any) => i.userId));
    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'Questions fetched',
      data: {
        items: items.map((q: any) => ({
          ...q,
          author: mapAuthor(q.userId, nameMap, slugMap),
          answerCount: q._count.answers,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = { success: false, code: 400, message: err.errors[0]?.message || 'Invalid query', data: null, trace_id: traceId };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'listQuestions');
  }
}

export async function getQuestionDetail(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const id = req.params.id;
    const viewerId = (res.locals.userId as string) || '';
    const question = await db.question.findUnique({
      where: { id },
      select: {
        id: true, userId: true, title: true, content: true, courseId: true, lessonId: true, isResolved: true, viewCount: true, upvoteCount: true, createdAt: true, updatedAt: true,
        course: { select: { id: true, title: true, slug: true } },
        answers: {
          orderBy: [{ isAccepted: 'desc' }, { upvoteCount: 'desc' }, { createdAt: 'asc' }],
          select: { id: true, userId: true, content: true, isAccepted: true, upvoteCount: true, createdAt: true, updatedAt: true },
        },
      },
    });
    if (!question) {
      const notFound: ApiResponse<null> = { success: false, code: 404, message: 'Question not found', data: null, trace_id: traceId };
      return res.status(404).json(notFound);
    }
    await db.question.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    const userIds = [question.userId, ...question.answers.map((a: any) => a.userId)];
    const { nameMap, slugMap } = await resolveAuthorContext(userIds);
    const votedQuestion = viewerId
      ? await db.questionUpvote.findUnique({ where: { questionId_userId: { questionId: id, userId: viewerId } }, select: { id: true } })
      : null;
    const votedAnswerIds = viewerId
      ? await db.answerUpvote.findMany({ where: { userId: viewerId, answerId: { in: question.answers.map((a: any) => a.id) } }, select: { answerId: true } })
      : [];
    const votedSet = new Set(votedAnswerIds.map((v: any) => v.answerId));

    const response: ApiResponse<any> = {
      success: true,
      code: 200,
      message: 'Question detail fetched',
      data: {
        ...question,
        author: mapAuthor(question.userId, nameMap, slugMap),
        upvotedByMe: Boolean(votedQuestion),
        answers: question.answers.map((a: any) => ({
          ...a,
          author: mapAuthor(a.userId, nameMap, slugMap),
          upvotedByMe: votedSet.has(a.id),
        })),
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getQuestionDetail');
  }
}

export async function createAnswer(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const userId = res.locals.userId as string;
    const questionId = req.params.id;
    const payload = createAnswerSchema.parse(req.body ?? {});
    const q = await db.question.findUnique({ where: { id: questionId }, select: { id: true } });
    if (!q) {
      const notFound: ApiResponse<null> = { success: false, code: 404, message: 'Question not found', data: null, trace_id: traceId };
      return res.status(404).json(notFound);
    }
    const answer = await db.answer.create({ data: { questionId, userId, content: payload.content } });
    return res.status(201).json({ success: true, code: 201, message: 'Answer created', data: answer, trace_id: traceId } satisfies ApiResponse<typeof answer>);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message || 'Invalid payload', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    }
    return handlePrismaError(err, res, traceId, 'createAnswer');
  }
}

export async function acceptAnswer(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const questionId = req.params.id;
    const answerId = req.params.answerId;
    const userId = res.locals.userId as string;
    const q = await db.question.findUnique({ where: { id: questionId }, select: { userId: true, id: true } });
    if (!q) return res.status(404).json({ success: false, code: 404, message: 'Question not found', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    if (q.userId !== userId) return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    const answer = await db.answer.findFirst({ where: { id: answerId, questionId }, select: { id: true } });
    if (!answer) return res.status(404).json({ success: false, code: 404, message: 'Answer not found', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    await db.$transaction([
      db.answer.updateMany({ where: { questionId }, data: { isAccepted: false } }),
      db.answer.update({ where: { id: answerId }, data: { isAccepted: true } }),
      db.question.update({ where: { id: questionId }, data: { isResolved: true } }),
    ]);
    return res.status(200).json({ success: true, code: 200, message: 'Answer accepted', data: { answerId }, trace_id: traceId } satisfies ApiResponse<{ answerId: string }>);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'acceptAnswer');
  }
}

export async function upvoteQuestion(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const questionId = req.params.id;
    const userId = res.locals.userId as string;
    const existing = await db.questionUpvote.findUnique({ where: { questionId_userId: { questionId, userId } } });
    if (existing) {
      await db.$transaction([
        db.questionUpvote.delete({ where: { id: existing.id } }),
        db.question.update({ where: { id: questionId }, data: { upvoteCount: { decrement: 1 } } }),
      ]);
      return res.status(200).json({ success: true, code: 200, message: 'Question unvoted', data: { upvoted: false }, trace_id: traceId } satisfies ApiResponse<{ upvoted: boolean }>);
    }
    await db.$transaction([
      db.questionUpvote.create({ data: { questionId, userId } }),
      db.question.update({ where: { id: questionId }, data: { upvoteCount: { increment: 1 } } }),
    ]);
    return res.status(200).json({ success: true, code: 200, message: 'Question upvoted', data: { upvoted: true }, trace_id: traceId } satisfies ApiResponse<{ upvoted: boolean }>);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'upvoteQuestion');
  }
}

export async function upvoteAnswer(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const answerId = req.params.id;
    const userId = res.locals.userId as string;
    const existing = await db.answerUpvote.findUnique({ where: { answerId_userId: { answerId, userId } } });
    if (existing) {
      await db.$transaction([
        db.answerUpvote.delete({ where: { id: existing.id } }),
        db.answer.update({ where: { id: answerId }, data: { upvoteCount: { decrement: 1 } } }),
      ]);
      return res.status(200).json({ success: true, code: 200, message: 'Answer unvoted', data: { upvoted: false }, trace_id: traceId } satisfies ApiResponse<{ upvoted: boolean }>);
    }
    await db.$transaction([
      db.answerUpvote.create({ data: { answerId, userId } }),
      db.answer.update({ where: { id: answerId }, data: { upvoteCount: { increment: 1 } } }),
    ]);
    return res.status(200).json({ success: true, code: 200, message: 'Answer upvoted', data: { upvoted: true }, trace_id: traceId } satisfies ApiResponse<{ upvoted: boolean }>);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'upvoteAnswer');
  }
}

export async function updateAnswer(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const id = req.params.id;
    const userId = res.locals.userId as string;
    const role = res.locals.userRole as string;
    const payload = updateAnswerSchema.parse(req.body ?? {});
    const answer = await db.answer.findUnique({ where: { id } });
    if (!answer) {
      return res.status(404).json({ success: false, code: 404, message: 'Answer not found', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    }
    if (answer.userId !== userId && !isAdmin(role)) {
      return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    }
    const updated = await db.answer.update({
      where: { id },
      data: { content: payload.content },
    });
    return res.status(200).json({ success: true, code: 200, message: 'Answer updated', data: updated, trace_id: traceId } satisfies ApiResponse<typeof updated>);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message || 'Invalid payload', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    }
    return handlePrismaError(err, res, traceId, 'updateAnswer');
  }
}

export async function deleteAnswer(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const id = req.params.id;
    const userId = res.locals.userId as string;
    const role = res.locals.userRole as string;
    const answer = await db.answer.findUnique({ where: { id }, select: { id: true, userId: true, questionId: true, isAccepted: true } });
    if (!answer) {
      return res.status(404).json({ success: false, code: 404, message: 'Answer not found', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    }
    if (answer.userId !== userId && !isAdmin(role)) {
      return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    }
    await db.$transaction(async (tx: any) => {
      await tx.answer.delete({ where: { id: answer.id } });
      if (answer.isAccepted) {
        await tx.question.update({ where: { id: answer.questionId }, data: { isResolved: false } });
      }
    });
    return res.status(200).json({ success: true, code: 200, message: 'Answer deleted', data: null, trace_id: traceId } satisfies ApiResponse<null>);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteAnswer');
  }
}

export async function updateQuestion(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const id = req.params.id;
    const userId = res.locals.userId as string;
    const role = res.locals.userRole as string;
    const payload = updateQuestionSchema.parse(req.body ?? {});
    const q = await db.question.findUnique({ where: { id } });
    if (!q) return res.status(404).json({ success: false, code: 404, message: 'Question not found', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    if (q.userId !== userId && !isAdmin(role)) return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    const updated = await db.question.update({
      where: { id },
      data: { title: payload.title ?? q.title, content: payload.content ?? q.content },
    });
    return res.status(200).json({ success: true, code: 200, message: 'Question updated', data: updated, trace_id: traceId } satisfies ApiResponse<typeof updated>);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message || 'Invalid payload', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    return handlePrismaError(err, res, traceId, 'updateQuestion');
  }
}

export async function deleteQuestion(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const id = req.params.id;
    const userId = res.locals.userId as string;
    const role = res.locals.userRole as string;
    const q = await db.question.findUnique({ where: { id } });
    if (!q) return res.status(404).json({ success: false, code: 404, message: 'Question not found', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    if (q.userId !== userId && !isAdmin(role)) return res.status(403).json({ success: false, code: 403, message: 'Forbidden', data: null, trace_id: traceId } satisfies ApiResponse<null>);
    await db.question.delete({ where: { id } });
    return res.status(200).json({ success: true, code: 200, message: 'Question deleted', data: null, trace_id: traceId } satisfies ApiResponse<null>);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteQuestion');
  }
}
