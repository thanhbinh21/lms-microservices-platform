import { Router, type Router as ExpressRouter, Request, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { createRequireAuth, type ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma.js';
import { resolveUserNames, getDisplayName } from '../lib/clients.js';

export const communityRouter: ExpressRouter = Router();
const requireAuth = createRequireAuth();

type NameMap = Map<string, { name: string; username: string | null; role?: string }>;
type CommunityPostRow = {
  id: string;
  authorId: string;
  content: string;
  imageUrl: string | null;
  parentId: string | null;
  likeCount: number;
  likedByIds: string[];
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
};

function isAdmin(role?: string): boolean {
  return (role || '').toUpperCase() === 'ADMIN';
}

function buildPostResponse(post: CommunityPostRow, nameMap: NameMap, userId: string) {
  return {
    id: post.id,
    content: post.content,
    imageUrl: post.imageUrl,
    parentId: post.parentId,
    likeCount: post.likeCount,
    likedByMe: post.likedByIds.includes(userId),
    isOwner: post.authorId === userId,
    replyCount: post.replyCount,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: {
      id: post.authorId,
      displayName: getDisplayName(post.authorId, nameMap),
      role: nameMap.get(post.authorId)?.role ?? '',
    },
  };
}

const listPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

const postBodySchema = z.object({
  content: z.string().trim().min(1).max(3000),
  imageUrl: z.string().url().optional().nullable(),
});

const updatePostBodySchema = z.object({
  content: z.string().trim().min(1).max(3000).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8').split('::');
    if (decoded.length !== 2) return null;
    const createdAt = new Date(decoded[0]);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: decoded[1] };
  } catch {
    return null;
  }
}

function encodeCursor(post: CommunityPostRow): string {
  return Buffer.from(`${post.createdAt.toISOString()}::${post.id}`).toString('base64url');
}

communityRouter.get('/posts', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;

  try {
    const { limit, cursor } = listPostsQuerySchema.parse(req.query);
    const decodedCursor = decodeCursor(cursor);
    const where: any = { parentId: null };

    if (decodedCursor) {
      where.OR = [
        { createdAt: { lt: decodedCursor.createdAt } },
        { createdAt: decodedCursor.createdAt, id: { lt: decodedCursor.id } },
      ];
    }

    const posts = await prisma.communityPost.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    const postIds = posts.map((post) => post.id);
    const replies = postIds.length > 0
      ? await prisma.communityPost.findMany({
          where: { parentId: { in: postIds } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      : [];

    const authorIds = [...new Set([...posts, ...replies].map((post) => post.authorId))];
    const nameMap = await resolveUserNames(authorIds);
    const repliesByPost = new Map<string, CommunityPostRow[]>();
    for (const reply of replies) {
      if (!reply.parentId) continue;
      const current = repliesByPost.get(reply.parentId) ?? [];
      current.push(reply);
      repliesByPost.set(reply.parentId, current);
    }

    const data = posts.map((post) => ({
      ...buildPostResponse(post, nameMap, userId),
      comments: (repliesByPost.get(post.id) ?? []).map((reply) => buildPostResponse(reply, nameMap, userId)),
      replies: (repliesByPost.get(post.id) ?? []).map((reply) => buildPostResponse(reply, nameMap, userId)),
    }));

    const response: ApiResponse<{ posts: typeof data; nextCursor: string | null }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { posts: data, nextCursor: hasMore && posts.length > 0 ? encodeCursor(posts[posts.length - 1]) : null },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'listCommunityFeedPosts failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

communityRouter.post('/posts', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;

  try {
    const { content, imageUrl } = postBodySchema.parse(req.body ?? {});
    const post = await prisma.communityPost.create({ data: { authorId: userId, content, imageUrl: imageUrl || null } });
    const nameMap = await resolveUserNames([userId]);
    const response: ApiResponse<ReturnType<typeof buildPostResponse> & { comments: unknown[]; replies: unknown[] }> = {
      success: true,
      code: 201,
      message: 'Da dang bai viet',
      data: { ...buildPostResponse(post, nameMap, userId), comments: [], replies: [] },
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    }
    logger.error({ err, userId, traceId }, 'createCommunityFeedPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

communityRouter.post('/posts/:postId/comments', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { postId } = req.params;

  try {
    const { content, imageUrl } = postBodySchema.parse(req.body ?? {});
    const parent = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, parentId: true } });
    if (!parent || parent.parentId) {
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay bai viet', data: null, trace_id: traceId });
    }

    const [comment] = await prisma.$transaction([
      prisma.communityPost.create({ data: { authorId: userId, content, imageUrl: imageUrl || null, parentId: postId } }),
      prisma.communityPost.update({ where: { id: postId }, data: { replyCount: { increment: 1 } } }),
    ]);

    const nameMap = await resolveUserNames([userId]);
    const response: ApiResponse<ReturnType<typeof buildPostResponse>> = {
      success: true,
      code: 201,
      message: 'Da gui binh luan',
      data: buildPostResponse(comment, nameMap, userId),
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    }
    logger.error({ err, userId, postId, traceId }, 'commentCommunityFeedPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

communityRouter.post('/posts/:postId/react', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const { postId } = req.params;

  try {
    const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, likedByIds: true } });
    if (!post) {
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay bai viet', data: null, trace_id: traceId });
    }

    const liked = post.likedByIds.includes(userId);
    const likedByIds = liked ? post.likedByIds.filter((id) => id !== userId) : [...post.likedByIds, userId];
    await prisma.communityPost.update({ where: { id: post.id }, data: { likedByIds, likeCount: likedByIds.length } });

    const response: ApiResponse<{ liked: boolean; likeCount: number }> = {
      success: true,
      code: 200,
      message: liked ? 'Da bo thich' : 'Da thich',
      data: { liked: !liked, likeCount: likedByIds.length },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, postId, traceId }, 'reactCommunityFeedPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

communityRouter.put('/posts/:postId', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;
  const { postId } = req.params;

  try {
    const payload = updatePostBodySchema.parse(req.body ?? {});
    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay bai viet', data: null, trace_id: traceId });
    }
    if (post.authorId !== userId && !isAdmin(userRole)) {
      return res.status(403).json({ success: false, code: 403, message: 'Ban khong co quyen sua bai nay', data: null, trace_id: traceId });
    }

    const updateData: { content?: string; imageUrl?: string | null } = {};
    if (payload.content !== undefined) updateData.content = payload.content;
    if (payload.imageUrl !== undefined) updateData.imageUrl = payload.imageUrl;

    const updated = await prisma.communityPost.update({ where: { id: postId }, data: updateData });
    const nameMap = await resolveUserNames([updated.authorId]);
    const response: ApiResponse<ReturnType<typeof buildPostResponse>> = {
      success: true,
      code: 200,
      message: 'Da cap nhat bai viet',
      data: buildPostResponse(updated, nameMap, userId),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    }
    logger.error({ err, userId, postId, traceId }, 'updateCommunityFeedPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

communityRouter.delete('/posts/:postId', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;
  const { postId } = req.params;

  try {
    const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true, parentId: true } });
    if (!post) {
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay bai viet', data: null, trace_id: traceId });
    }
    if (post.authorId !== userId && !isAdmin(userRole)) {
      return res.status(403).json({ success: false, code: 403, message: 'Ban khong co quyen xoa bai nay', data: null, trace_id: traceId });
    }

    if (post.parentId) {
      await prisma.$transaction([
        prisma.communityPost.delete({ where: { id: post.id } }),
        prisma.communityPost.update({ where: { id: post.parentId }, data: { replyCount: { decrement: 1 } } }),
      ]);
    } else {
      await prisma.communityPost.delete({ where: { id: post.id } });
    }

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      code: 200,
      message: 'Da xoa bai viet',
      data: { deleted: true },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, postId, traceId }, 'deleteCommunityFeedPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});
