import { Router, type Router as ExpressRouter, Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma.js';
import { checkEnrollment, resolveUserNames, getDisplayName } from '../lib/clients.js';

export const communityRouter: ExpressRouter = Router();

// Middleware lay userId tu header
function requireAuth(req: Request, res: Response, next: Function): void {
  if (!res.locals.userId) {
    const response: ApiResponse<null> = {
      success: false, code: 401, message: 'Unauthorized', data: null,
      trace_id: (req.headers['x-trace-id'] as string) || '',
    };
    res.status(401).json(response);
    return;
  }
  next();
}

// ─── GET /api/community/groups ───────────────────────────────────────────────

communityRouter.get('/groups', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    // Lay groups da join
    const memberships = await prisma.communityMember.findMany({
      where: { userId },
      include: {
        group: true,
      },
      orderBy: { joinedAt: 'desc' },
    });

    const joinedGroupIds = memberships.map((m) => m.group.id);

    // Lay public groups chua join (PUBLIC hoac GLOBAL)
    const publicGroups = await prisma.communityGroup.findMany({
      where: { type: { in: ['PUBLIC', 'GLOBAL'] }, id: { notIn: joinedGroupIds } },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse<{ joinedGroups: unknown[]; publicGroups: unknown[] }> = {
      success: true,
      code: 200,
      message: 'Danh sách nhóm cộng đồng',
      data: {
        joinedGroups: memberships.map((m) => ({ ...m.group, joinedAt: m.joinedAt })),
        publicGroups,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'listCommunityGroups failed');
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── POST /api/community/groups/:groupId/join ────────────────────────────────

communityRouter.post('/groups/:groupId/join', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { groupId } = req.params;

  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ success: false, code: 404, message: 'Không tìm thấy nhóm', data: null, trace_id: traceId });
    }

    if (group.isArchived) {
      return res.status(410).json({ success: false, code: 410, message: 'Nhóm đã bị lưu trữ', data: null, trace_id: traceId });
    }

    // COURSE_PRIVATE: kiem tra enrollment qua learning-service
    if (group.type === 'COURSE_PRIVATE' && group.courseId) {
      const enrolled = await checkEnrollment(userId, group.courseId);
      if (!enrolled) {
        return res.status(403).json({
          success: false, code: 403, message: 'Bạn chưa ghi danh khóa học này', data: null, trace_id: traceId,
        });
      }
    }

    // Upsert membership
    const existed = await prisma.communityMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    let memberCreated = false;
    if (!existed) {
      try {
        await prisma.$transaction([
          prisma.communityMember.create({ data: { groupId, userId } }),
          prisma.communityGroup.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } }),
        ]);
        memberCreated = true;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }

    const updatedGroup = await prisma.communityGroup.findUnique({ where: { id: groupId } });
    const response: ApiResponse<{ group: typeof updatedGroup; joined: boolean }> = {
      success: true,
      code: memberCreated ? 201 : 200,
      message: memberCreated ? 'Đã tham gia nhóm' : 'Bạn đã là thành viên',
      data: { group: updatedGroup, joined: true },
      trace_id: traceId,
    };
    return res.status(memberCreated ? 201 : 200).json(response);
  } catch (err) {
    logger.error({ err, userId, groupId, traceId }, 'joinCommunityGroup failed');
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── GET /api/community/groups/:groupId/posts ────────────────────────────────

const listPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

communityRouter.get('/groups/:groupId/posts', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { groupId } = req.params;

  try {
    const { limit, cursor } = listPostsQuerySchema.parse(req.query);

    // Verify membership
    const member = await prisma.communityMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, code: 403, message: 'Bạn chưa tham gia nhóm này', data: null, trace_id: traceId });
    }

    const where: any = { groupId, parentId: null };
    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf-8').split('::');
      if (decoded.length === 2) {
        where.OR = [
          { createdAt: { lt: new Date(decoded[0]) } },
          { createdAt: decoded[0], id: { lt: decoded[1] } },
        ];
      }
    }

    const posts = await prisma.communityPost.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    // Resolve user names
    const authorIds = [...new Set(posts.map((p) => p.authorId))];
    const nameMap = await resolveUserNames(authorIds);

    const data = posts.map((p) => ({
      ...p,
      authorName: getDisplayName(p.authorId, nameMap),
    }));

    const nextCursor = hasMore && posts.length > 0
      ? Buffer.from(`${posts[posts.length - 1].createdAt.toISOString()}::${posts[posts.length - 1].id}`).toString('base64url')
      : null;

    const response: ApiResponse<{ posts: typeof data; nextCursor: string | null }> = {
      success: true, code: 200, message: 'OK', data: { posts: data, nextCursor }, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, groupId, traceId }, 'listCommunityPosts failed');
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── POST /api/community/groups/:groupId/posts ───────────────────────────────

const postBodySchema = z.object({
  content: z.string().trim().min(1).max(3000),
  imageUrl: z.string().url().optional(),
});

communityRouter.post('/groups/:groupId/posts', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { groupId } = req.params;

  try {
    const { content, imageUrl } = postBodySchema.parse(req.body);

    const group = await prisma.communityGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ success: false, code: 404, message: 'Không tìm thấy nhóm', data: null, trace_id: traceId });
    }
    if (group.isArchived) {
      return res.status(410).json({ success: false, code: 410, message: 'Nhóm đã bị lưu trữ (chỉ đọc)', data: null, trace_id: traceId });
    }

    const member = await prisma.communityMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!member) {
      return res.status(403).json({ success: false, code: 403, message: 'Bạn chưa tham gia nhóm này', data: null, trace_id: traceId });
    }

    const [post] = await prisma.$transaction([
      prisma.communityPost.create({ data: { groupId, authorId: userId, content, imageUrl } }),
      prisma.communityGroup.update({ where: { id: groupId }, data: { postCount: { increment: 1 } } }),
    ]);

    const response: ApiResponse<typeof post> = {
      success: true, code: 201, message: 'Đã đăng bài viết', data: post, trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    }
    logger.error({ err, userId, groupId, traceId }, 'createCommunityPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});

// ─── POST /api/community/groups/:groupId/posts/:postId/react ─────────────────

communityRouter.post('/groups/:groupId/posts/:postId/react', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { postId } = req.params;

  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, likedByIds: true, likeCount: true },
    });
    if (!post) {
      return res.status(404).json({ success: false, code: 404, message: 'Không tìm thấy bài viết', data: null, trace_id: traceId });
    }

    const hasLiked = post.likedByIds.includes(userId);
    const newLikedByIds = hasLiked ? post.likedByIds.filter((id) => id !== userId) : [...post.likedByIds, userId];

    await prisma.communityPost.update({
      where: { id: post.id },
      data: { likedByIds: newLikedByIds, likeCount: newLikedByIds.length },
    });

    const response: ApiResponse<{ liked: boolean; likeCount: number }> = {
      success: true, code: 200, message: hasLiked ? 'Đã bỏ thích' : 'Đã thích',
      data: { liked: !hasLiked, likeCount: newLikedByIds.length },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, postId, traceId }, 'reactCommunityPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Lỗi hệ thống', data: null, trace_id: traceId });
  }
});
