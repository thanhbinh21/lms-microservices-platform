import { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/index.js';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import {
  backfillCommunityMembershipByEnrollment,
  ensureCommunityMembershipByGroup,
} from '../lib/community';

const groupParamsSchema = z.object({
  groupId: z.string().uuid('groupId khong hop le'),
});

const replyParamsSchema = z.object({
  groupId: z.string().uuid('groupId khong hop le'),
  postId: z.string().uuid('postId khong hop le'),
});

const listPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

const postBodySchema = z.object({
  content: z.string().trim().min(1, 'Noi dung khong duoc rong').max(3000, 'Noi dung toi da 3000 ky tu'),
});

function buildDisplayNameFromUserId(userId: string): string {
  return `Hoc vien #${userId.slice(0, 8)}`;
}

function encodeCursor(input: { createdAt: Date; id: string }): string {
  return Buffer.from(`${input.createdAt.toISOString()}::${input.id}`, 'utf-8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const [createdAtIso, id] = decoded.split('::');
    const createdAt = new Date(createdAtIso);

    if (!id || Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return { createdAt, id };
  } catch {
    return null;
  }
}

function mapGroupSummary(group: {
  id: string;
  courseId: string;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  };
}) {
  return {
    id: group.id,
    courseId: group.courseId,
    name: group.name,
    slug: group.slug,
    description: group.description,
    memberCount: group.memberCount,
    postCount: group.postCount,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    course: group.course,
  };
}

/**
 * GET /api/community/groups
 */
export async function listCommunityGroups(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    // Backfill moi lan de dam bao user luon thay du tat ca nhom theo enrollment hien tai.
    await backfillCommunityMembershipByEnrollment(userId);

    const memberships = await prisma.communityMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'desc' },
      select: {
        joinedAt: true,
        group: {
          select: {
            id: true,
            courseId: true,
            name: true,
            slug: true,
            description: true,
            memberCount: true,
            postCount: true,
            createdAt: true,
            updatedAt: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                thumbnail: true,
                level: true,
              },
            },
          },
        },
      },
    });

    const response: ApiResponse<{
      groups: Array<{
        id: string;
        courseId: string;
        name: string;
        slug: string;
        description: string | null;
        memberCount: number;
        postCount: number;
        joinedAt: Date;
        createdAt: Date;
        updatedAt: Date;
        course: {
          id: string;
          title: string;
          slug: string;
          thumbnail: string | null;
          level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
        };
      }>;
    }> = {
      success: true,
      code: 200,
      message: 'Community groups fetched',
      data: {
        groups: memberships.map((item) => ({
          ...mapGroupSummary(item.group),
          joinedAt: item.joinedAt,
        })),
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listCommunityGroups');
  }
}

/**
 * POST /api/community/groups/:groupId/join
 */
export async function joinCommunityGroup(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  const parsedParams = groupParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedParams.error.issues[0]?.message || 'groupId khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const result = await ensureCommunityMembershipByGroup({
      userId,
      groupId: parsedParams.data.groupId,
    });

    if (result.status === 'NOT_FOUND') {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Community group not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (result.status === 'FORBIDDEN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Ban chua ghi danh khoa hoc nay nen khong the tham gia nhom',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const response: ApiResponse<{
      group: ReturnType<typeof mapGroupSummary>;
      joined: boolean;
    }> = {
      success: true,
      code: result.memberCreated ? 201 : 200,
      message: result.memberCreated ? 'Joined group successfully' : 'Already joined',
      data: {
        group: mapGroupSummary(result.group),
        joined: true,
      },
      trace_id: traceId,
    };

    return res.status(result.memberCreated ? 201 : 200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'joinCommunityGroup');
  }
}

/**
 * GET /api/community/groups/:groupId/posts
 */
export async function listCommunityPosts(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  const parsedParams = groupParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedParams.error.issues[0]?.message || 'groupId khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  const parsedQuery = listPostsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedQuery.error.issues[0]?.message || 'Query khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  const cursorPayload = parsedQuery.data.cursor
    ? decodeCursor(parsedQuery.data.cursor)
    : null;

  if (parsedQuery.data.cursor && !cursorPayload) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: 'Cursor khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const membership = await ensureCommunityMembershipByGroup({
      userId,
      groupId: parsedParams.data.groupId,
    });

    if (membership.status === 'NOT_FOUND') {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Community group not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (membership.status === 'FORBIDDEN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Ban chua tham gia nhom nay',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const where: Prisma.CommunityPostWhereInput = {
      groupId: parsedParams.data.groupId,
      parentId: null,
    };

    if (cursorPayload) {
      // Cursor hai truong (createdAt + id) giup phan trang on dinh khi co nhieu post cung timestamp.
      where.OR = [
        { createdAt: { lt: cursorPayload.createdAt } },
        {
          createdAt: cursorPayload.createdAt,
          id: { lt: cursorPayload.id },
        },
      ];
    }

    const posts = await prisma.communityPost.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: parsedQuery.data.limit + 1,
      select: {
        id: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            authorId: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const hasMore = posts.length > parsedQuery.data.limit;
    const items = hasMore ? posts.slice(0, parsedQuery.data.limit) : posts;
    const nextCursor = hasMore
      ? encodeCursor({
          id: items[items.length - 1].id,
          createdAt: items[items.length - 1].createdAt,
        })
      : null;

    const response: ApiResponse<{
      group: ReturnType<typeof mapGroupSummary>;
      items: Array<{
        id: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        author: {
          id: string;
          displayName: string;
        };
        replies: Array<{
          id: string;
          content: string;
          createdAt: Date;
          updatedAt: Date;
          author: {
            id: string;
            displayName: string;
          };
        }>;
      }>;
      nextCursor: string | null;
    }> = {
      success: true,
      code: 200,
      message: 'Community posts fetched',
      data: {
        group: mapGroupSummary(membership.group),
        items: items.map((post) => ({
          id: post.id,
          content: post.content,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          author: {
            id: post.authorId,
            displayName: buildDisplayNameFromUserId(post.authorId),
          },
          replies: post.replies.map((reply) => ({
            id: reply.id,
            content: reply.content,
            createdAt: reply.createdAt,
            updatedAt: reply.updatedAt,
            author: {
              id: reply.authorId,
              displayName: buildDisplayNameFromUserId(reply.authorId),
            },
          })),
        })),
        nextCursor,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listCommunityPosts');
  }
}

/**
 * POST /api/community/groups/:groupId/posts
 */
export async function createCommunityPost(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  const parsedParams = groupParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedParams.error.issues[0]?.message || 'groupId khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  const parsedBody = postBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedBody.error.issues[0]?.message || 'Body khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const membership = await ensureCommunityMembershipByGroup({
      userId,
      groupId: parsedParams.data.groupId,
    });

    if (membership.status === 'NOT_FOUND') {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Community group not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (membership.status === 'FORBIDDEN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Ban chua tham gia nhom nay',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.communityPost.create({
        data: {
          groupId: parsedParams.data.groupId,
          authorId: userId,
          content: parsedBody.data.content,
        },
        select: {
          id: true,
          authorId: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.communityGroup.update({
        where: { id: parsedParams.data.groupId },
        data: { postCount: { increment: 1 } },
      });

      return created;
    });

    const response: ApiResponse<{
      id: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      author: {
        id: string;
        displayName: string;
      };
    }> = {
      success: true,
      code: 201,
      message: 'Post created',
      data: {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: {
          id: post.authorId,
          displayName: buildDisplayNameFromUserId(post.authorId),
        },
      },
      trace_id: traceId,
    };

    return res.status(201).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'createCommunityPost');
  }
}

/**
 * POST /api/community/groups/:groupId/posts/:postId/reply
 */
export async function replyCommunityPost(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  const parsedParams = replyParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedParams.error.issues[0]?.message || 'Param khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  const parsedBody = postBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedBody.error.issues[0]?.message || 'Body khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const membership = await ensureCommunityMembershipByGroup({
      userId,
      groupId: parsedParams.data.groupId,
    });

    if (membership.status === 'NOT_FOUND') {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Community group not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (membership.status === 'FORBIDDEN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Ban chua tham gia nhom nay',
        data: null,
        trace_id: traceId,
      };
      return res.status(403).json(response);
    }

    const parentPost = await prisma.communityPost.findUnique({
      where: { id: parsedParams.data.postId },
      select: {
        id: true,
        groupId: true,
        parentId: true,
      },
    });

    if (!parentPost || parentPost.groupId !== parsedParams.data.groupId) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Post not found in this group',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (parentPost.parentId) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Chi cho phep reply truc tiep vao bai viet goc',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const reply = await prisma.$transaction(async (tx) => {
      const created = await tx.communityPost.create({
        data: {
          groupId: parsedParams.data.groupId,
          authorId: userId,
          parentId: parsedParams.data.postId,
          content: parsedBody.data.content,
        },
        select: {
          id: true,
          authorId: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.communityGroup.update({
        where: { id: parsedParams.data.groupId },
        data: { postCount: { increment: 1 } },
      });

      return created;
    });

    const response: ApiResponse<{
      id: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      author: {
        id: string;
        displayName: string;
      };
    }> = {
      success: true,
      code: 201,
      message: 'Reply created',
      data: {
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: {
          id: reply.authorId,
          displayName: buildDisplayNameFromUserId(reply.authorId),
        },
      },
      trace_id: traceId,
    };

    return res.status(201).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'replyCommunityPost');
  }
}
