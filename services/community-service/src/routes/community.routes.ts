import { Router, type Router as ExpressRouter, Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma.js';
import { checkEnrollment, resolveUserNames, getDisplayName } from '../lib/clients.js';

export const communityRouter: ExpressRouter = Router();

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

type NameMap = Map<string, { name: string; username: string | null; role?: string }>;

function buildPostResponse(
  post: { id: string; content: string; imageUrl: string | null; likeCount: number; likedByIds: string[]; createdAt: Date; updatedAt: Date; authorId: string },
  nameMap: NameMap,
  userId: string,
) {
  return {
    id: post.id,
    content: post.content,
    imageUrl: post.imageUrl,
    likeCount: post.likeCount,
    likedByMe: post.likedByIds.includes(userId),
    isOwner: post.authorId === userId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: {
      id: post.authorId,
      displayName: getDisplayName(post.authorId, nameMap),
      role: nameMap.get(post.authorId)?.role ?? '',
    },
  };
}

// ─── GET /api/community/groups ───────────────────────────────────────────────

communityRouter.get('/groups', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const memberships = await prisma.communityMember.findMany({
      where: { userId },
      include: { group: true },
      orderBy: { joinedAt: 'desc' },
    });

    const joinedGroupIds = memberships.map((m) => m.group.id);

    const publicGroups = await prisma.communityGroup.findMany({
      where: { type: { in: ['PUBLIC', 'GLOBAL'] }, id: { notIn: joinedGroupIds } },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse<{ joinedGroups: unknown[]; publicGroups: unknown[] }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: {
        joinedGroups: memberships.map((m) => ({ ...m.group, joinedAt: m.joinedAt })),
        publicGroups,
      },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'listCommunityGroups failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

// ─── GET /api/community/groups/my-groups ──────────────────────────────────
// Danh sach nhom user co the dang bai (GLOBAL + COURSE_PRIVATE da enroll)

communityRouter.get('/groups/my-groups', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const memberships = await prisma.communityMember.findMany({
      where: { userId },
      include: { group: true },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = memberships
      .filter((m) => m.group.type === 'GLOBAL' || m.group.type === 'COURSE_PRIVATE')
      .map((m) => ({
        id: m.group.id,
        type: m.group.type,
        name: m.group.name,
        description: m.group.description,
        memberCount: m.group.memberCount,
        postCount: m.group.postCount,
        courseId: m.group.courseId,
        isArchived: m.group.isArchived,
      }));

    const response: ApiResponse<typeof groups> = {
      success: true, code: 200, message: 'OK', data: groups, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'listMyGroups failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
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
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay nhom', data: null, trace_id: traceId });
    }

    if (group.isArchived) {
      return res.status(410).json({ success: false, code: 410, message: 'Nhom da bi luu tru', data: null, trace_id: traceId });
    }

    if (group.type === 'COURSE_PRIVATE' && group.courseId) {
      const enrolled = await checkEnrollment(userId, group.courseId);
      if (!enrolled) {
        return res.status(403).json({
          success: false, code: 403, message: 'Ban chua ghi danh khoa hoc nay', data: null, trace_id: traceId,
        });
      }
    }

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
      message: memberCreated ? 'Da tham gia nhom' : 'Ban da la thanh vien',
      data: { group: updatedGroup, joined: true },
      trace_id: traceId,
    };
    return res.status(memberCreated ? 201 : 200).json(response);
  } catch (err) {
    logger.error({ err, userId, groupId, traceId }, 'joinCommunityGroup failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

// ─── GET /api/community/groups/:groupId/posts ──────────────────────────────

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

    const member = await prisma.communityMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, code: 403, message: 'Ban chua tham gia nhom nay', data: null, trace_id: traceId });
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

    // Lay tat ca user IDs can resolve (author + likedByIds)
    const allUserIds = [...new Set(posts.flatMap((p) => [p.authorId, ...p.likedByIds]))];
    const nameMap = await resolveUserNames(allUserIds);

    const data = await Promise.all(posts.map(async (p) => {
      const replies = await prisma.communityPost.findMany({
        where: { parentId: p.id },
        orderBy: { createdAt: 'asc' },
      });

      const allReplyUserIds = [...new Set(replies.flatMap((r) => [r.authorId, ...r.likedByIds]))];
      const replyNameMap = await resolveUserNames(allReplyUserIds);

      return {
        ...buildPostResponse(p, nameMap, userId),
        replies: replies.map((r) => ({
          ...buildPostResponse(r, replyNameMap, userId),
        })),
      };
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
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
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
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay nhom', data: null, trace_id: traceId });
    }
    if (group.isArchived) {
      return res.status(410).json({ success: false, code: 410, message: 'Nhom chi doc', data: null, trace_id: traceId });
    }

    const member = await prisma.communityMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, code: 403, message: 'Ban chua tham gia nhom nay', data: null, trace_id: traceId });
    }

    const [post] = await prisma.$transaction([
      prisma.communityPost.create({ data: { groupId, authorId: userId, content, imageUrl } }),
      prisma.communityGroup.update({ where: { id: groupId }, data: { postCount: { increment: 1 } } }),
    ]);

    const nameMap = await resolveUserNames([userId]);
    const response: ApiResponse<ReturnType<typeof buildPostResponse>> = {
      success: true, code: 201, message: 'Da dang bai viet',
      data: buildPostResponse(post, nameMap, userId),
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    }
    logger.error({ err, userId, groupId, traceId }, 'createCommunityPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
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
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay bai viet', data: null, trace_id: traceId });
    }

    const hasLiked = post.likedByIds.includes(userId);
    const newLikedByIds = hasLiked
      ? post.likedByIds.filter((id) => id !== userId)
      : [...post.likedByIds, userId];

    await prisma.communityPost.update({
      where: { id: post.id },
      data: { likedByIds: newLikedByIds, likeCount: newLikedByIds.length },
    });

    const response: ApiResponse<{ liked: boolean; likeCount: number }> = {
      success: true, code: 200, message: hasLiked ? 'Da bo thich' : 'Da thich',
      data: { liked: !hasLiked, likeCount: newLikedByIds.length },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, postId, traceId }, 'reactCommunityPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

// ─── POST /api/community/groups/:groupId/posts/:postId/reply ───────────────

const replyBodySchema = z.object({
  content: z.string().trim().min(1).max(3000),
  imageUrl: z.string().url().optional(),
});

communityRouter.post('/groups/:groupId/posts/:postId/reply', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { groupId, postId } = req.params;

  try {
    const { content, imageUrl } = replyBodySchema.parse(req.body);

    const parentPost = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, groupId: true },
    });
    if (!parentPost) {
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay bai viet goc', data: null, trace_id: traceId });
    }
    if (parentPost.groupId !== groupId) {
      return res.status(400).json({ success: false, code: 400, message: 'Bai viet khong thuoc nhom nay', data: null, trace_id: traceId });
    }

    const member = await prisma.communityMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, code: 403, message: 'Ban chua tham gia nhom nay', data: null, trace_id: traceId });
    }

    const [reply] = await prisma.$transaction([
      prisma.communityPost.create({
        data: { groupId, authorId: userId, content, imageUrl, parentId: postId },
      }),
      prisma.communityPost.update({
        where: { id: postId },
        data: { replyCount: { increment: 1 } },
      }),
    ]);

    const nameMap = await resolveUserNames([userId]);
    const response: ApiResponse<ReturnType<typeof buildPostResponse>> = {
      success: true, code: 201, message: 'Da gui phan hoi',
      data: buildPostResponse(reply, nameMap, userId),
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, code: 400, message: err.errors[0]?.message, data: null, trace_id: traceId });
    }
    logger.error({ err, userId, groupId, postId, traceId }, 'replyCommunityPost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

// ─── PUT /api/community/groups/:groupId/posts/:postId ─────────────────────────

const updatePostBodySchema = z.object({
  content: z.string().trim().min(1).max(3000).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

communityRouter.put('/groups/:groupId/posts/:postId', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const userRole = (res.locals.userRole as string || '').toUpperCase();
  const { groupId, postId } = req.params;

  try {
    const parsed = updatePostBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 400, message: parsed.error.errors[0]?.message, data: null, trace_id: traceId });
    }
    const { content, imageUrl } = parsed.data;

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, groupId: true, authorId: true, imageUrl: true },
    });
    if (!post) {
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay bai viet', data: null, trace_id: traceId });
    }
    if (post.groupId !== groupId) {
      return res.status(400).json({ success: false, code: 400, message: 'Bai viet khong thuoc nhom nay', data: null, trace_id: traceId });
    }
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ success: false, code: 403, message: 'Ban khong co quyen sua bai nay', data: null, trace_id: traceId });
    }

    const updateData: { content?: string; imageUrl?: string | null } = {};
    if (content !== undefined) updateData.content = content;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

    const updated = await prisma.communityPost.update({
      where: { id: postId },
      data: updateData,
    });

    const nameMap = await resolveUserNames([updated.authorId]);
    const response: ApiResponse<ReturnType<typeof buildPostResponse>> = {
      success: true, code: 200, message: 'Da cap nhat bai viet',
      data: buildPostResponse(updated, nameMap, userId),
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, groupId, postId, traceId }, 'updatePost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

// ─── DELETE /api/community/groups/:groupId/posts/:postId ─────────────────────

communityRouter.delete('/groups/:groupId/posts/:postId', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const userRole = (res.locals.userRole as string || '').toUpperCase();
  const { groupId, postId } = req.params;

  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, groupId: true, authorId: true },
    });
    if (!post) {
      return res.status(404).json({ success: false, code: 404, message: 'Khong tim thay bai viet', data: null, trace_id: traceId });
    }
    if (post.groupId !== groupId) {
      return res.status(400).json({ success: false, code: 400, message: 'Bai viet khong thuoc nhom nay', data: null, trace_id: traceId });
    }
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ success: false, code: 403, message: 'Ban khong co quyen xoa bai nay', data: null, trace_id: traceId });
    }

    // Delete replies first (cascade should handle, but be explicit)
    await prisma.communityPost.deleteMany({ where: { parentId: postId } });
    await prisma.communityPost.delete({ where: { id: postId } });

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true, code: 200, message: 'Da xoa bai viet',
      data: { deleted: true },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, groupId, postId, traceId }, 'deletePost failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

// ─── GET /api/community/groups/:groupId/posts/hot ────────────────────────────

communityRouter.get('/groups/:groupId/posts/hot', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { groupId } = req.params;

  try {
    const member = await prisma.communityMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, code: 403, message: 'Ban chua tham gia nhom nay', data: null, trace_id: traceId });
    }

    // Lay bai viet co nhieu like nhat trong 7 ngay hoac top all-time
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const posts = await prisma.communityPost.findMany({
      where: {
        groupId,
        parentId: null,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: [{ likeCount: 'desc' }, { replyCount: 'desc' }],
      take: 5,
    });

    if (posts.length === 0) {
      // Neu khong co bai trong 7 ngay, lay top all-time
      const fallback = await prisma.communityPost.findMany({
        where: { groupId, parentId: null },
        orderBy: [{ likeCount: 'desc' }, { replyCount: 'desc' }],
        take: 5,
      });
      const authorIds = [...new Set(fallback.map((p) => p.authorId))];
      const nameMap = await resolveUserNames(authorIds);
      const data = fallback.map((p) => ({
        ...buildPostResponse(p, nameMap, userId),
        replies: [],
      }));
      return res.status(200).json({ success: true, code: 200, message: 'OK', data, trace_id: traceId });
    }

    const authorIds = [...new Set(posts.map((p) => p.authorId))];
    const nameMap = await resolveUserNames(authorIds);
    const data = posts.map((p) => ({
      ...buildPostResponse(p, nameMap, userId),
      replies: [],
    }));

    return res.status(200).json({ success: true, code: 200, message: 'OK', data, trace_id: traceId });
  } catch (err) {
    logger.error({ err, userId, groupId, traceId }, 'hotPosts failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});

// ─── GET /api/community/groups/:groupId/members/featured ──────────────────────

communityRouter.get('/groups/:groupId/members/featured', requireAuth, async (req: Request, res: Response) => {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;
  const { groupId } = req.params;

  try {
    const member = await prisma.communityMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, code: 403, message: 'Ban chua tham gia nhom nay', data: null, trace_id: traceId });
    }

    // Lay top 5 thanh vien co nhieu bai viet nhat trong nhom
    const topAuthors = await prisma.communityPost.groupBy({
      by: ['authorId'],
      where: { groupId, parentId: null },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const authorIds = topAuthors.map((a) => a.authorId);
    const nameMap = await resolveUserNames(authorIds);

    const data = topAuthors.map((a) => {
      const info = nameMap.get(a.authorId);
      return {
        authorId: a.authorId,
        displayName: info?.name || 'Nguoi dung',
        role: info?.role || '',
        postCount: a._count.id,
      };
    });

    return res.status(200).json({ success: true, code: 200, message: 'OK', data, trace_id: traceId });
  } catch (err) {
    logger.error({ err, userId, groupId, traceId }, 'featuredMembers failed');
    return res.status(500).json({ success: false, code: 500, message: 'Loi he thong', data: null, trace_id: traceId });
  }
});
