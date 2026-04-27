import { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/index.js';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import {
  backfillCommunityMembershipByEnrollment,
  ensureCommunityMembershipByGroup,
  resolveUserNames,
  getDisplayName,
} from '../lib/community';

const groupParamsSchema = z.object({
  groupId: z.string().uuid('groupId không hợp lệ'),
});

const replyParamsSchema = z.object({
  groupId: z.string().uuid('groupId không hợp lệ'),
  postId: z.string().uuid('postId không hợp lệ'),
});

const listPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

const postBodySchema = z.object({
  content: z.string().trim().min(1, 'Nội dung không được rỗng').max(3000, 'Nội dung tối đa 3000 ký tự'),
  imageUrl: z.string().url('URL ảnh không hợp lệ').optional(),
});

// Schema tao public community (admin-only)
const createPublicGroupSchema = z.object({
  name: z.string().trim().min(2, 'Tên nhóm tối thiểu 2 ký tự').max(100),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug chỉ chứa chữ thường, số và dấu gạch ngang'),
  description: z.string().trim().max(500).optional(),
});

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
  type: string;
  courseId: string | null;
  ownerId: string;
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
  } | null;
}) {
  return {
    id: group.id,
    type: group.type,
    courseId: group.courseId,
    ownerId: group.ownerId,
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
 * Lay danh sach nhom: public groups + private groups cua user
 */
export async function listCommunityGroups(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    // Backfill membership cho cac khoa hoc da enroll
    await backfillCommunityMembershipByEnrollment(userId);

    // Lay private groups cua user (da join)
    const memberships = await prisma.communityMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'desc' },
      select: {
        joinedAt: true,
        group: {
          select: {
            id: true,
            type: true,
            courseId: true,
            ownerId: true,
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

    // Lay them public groups chua join de hien thi
    const joinedGroupIds = memberships.map((m) => m.group.id);
    const publicGroups = await prisma.communityGroup.findMany({
      where: {
        type: 'PUBLIC',
        id: { notIn: joinedGroupIds },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        courseId: true,
        ownerId: true,
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
    });

    const response: ApiResponse<{
      joinedGroups: Array<ReturnType<typeof mapGroupSummary> & { joinedAt: Date }>;
      publicGroups: Array<ReturnType<typeof mapGroupSummary>>;
    }> = {
      success: true,
      code: 200,
      message: 'Danh sách nhóm cộng đồng',
      data: {
        joinedGroups: memberships.map((item) => ({
          ...mapGroupSummary(item.group),
          joinedAt: item.joinedAt,
        })),
        publicGroups: publicGroups.map(mapGroupSummary),
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listCommunityGroups');
  }
}

/**
 * POST /api/community/groups/:groupId/posts/:postId/react
 */
export async function reactCommunityPost(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  const parsedParams = replyParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedParams.error.issues[0]?.message || 'Tham số không hợp lệ',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const post = await prisma.communityPost.findUnique({
      where: {
        id: parsedParams.data.postId,
        groupId: parsedParams.data.groupId,
      },
      select: {
        id: true,
        likedByIds: true,
        likeCount: true,
      },
    });

    if (!post) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Không tìm thấy bài viết',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const hasLiked = post.likedByIds.includes(userId);
    const newLikedByIds = hasLiked
      ? post.likedByIds.filter((id) => id !== userId)
      : [...post.likedByIds, userId];
    const newLikeCount = newLikedByIds.length;

    await prisma.communityPost.update({
      where: { id: post.id },
      data: {
        likedByIds: newLikedByIds,
        likeCount: newLikeCount,
      },
    });

    const response: ApiResponse<{ liked: boolean; likeCount: number }> = {
      success: true,
      code: 200,
      message: hasLiked ? 'Đã bỏ thích bài viết' : 'Đã thích bài viết',
      data: {
        liked: !hasLiked,
        likeCount: newLikeCount,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'reactCommunityPost');
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
      message: parsedParams.error.issues[0]?.message || 'groupId không hợp lệ',
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
        message: 'Không tìm thấy nhóm cộng đồng',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (result.status === 'FORBIDDEN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Bạn chưa ghi danh khóa học này nên không thể tham gia nhóm',
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
      message: result.memberCreated ? 'Đã tham gia nhóm thành công' : 'Bạn đã là thành viên',
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
      message: parsedParams.error.issues[0]?.message || 'groupId không hợp lệ',
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
      message: parsedQuery.error.issues[0]?.message || 'Query không hợp lệ',
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
      message: 'Cursor không hợp lệ',
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
        message: 'Không tìm thấy nhóm cộng đồng',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (membership.status === 'FORBIDDEN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Bạn chưa tham gia nhóm này',
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
      // Cursor hai truong (createdAt + id) giup phan trang on dinh khi co nhieu post cung timestamp
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
        imageUrl: true,
        likeCount: true,
        likedByIds: true,
        createdAt: true,
        updatedAt: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            authorId: true,
            content: true,
            imageUrl: true,
            likeCount: true,
            likedByIds: true,
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

    // Resolve ten that cua tac gia tu auth-service
    const allAuthorIds = new Set<string>();
    for (const post of items) {
      allAuthorIds.add(post.authorId);
      for (const reply of post.replies) {
        allAuthorIds.add(reply.authorId);
      }
    }
    const nameMap = await resolveUserNames([...allAuthorIds]);

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
      message: 'Danh sách bài viết',
      data: {
        group: mapGroupSummary(membership.group),
        items: items.map((post) => ({
          id: post.id,
          content: post.content,
          imageUrl: post.imageUrl,
          likeCount: post.likeCount,
          likedByMe: post.likedByIds.includes(userId),
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          author: {
            id: post.authorId,
            displayName: getDisplayName(post.authorId, nameMap),
          },
          replies: post.replies.map((reply) => ({
            id: reply.id,
            content: reply.content,
            imageUrl: reply.imageUrl,
            likeCount: reply.likeCount,
            likedByMe: reply.likedByIds.includes(userId),
            createdAt: reply.createdAt,
            updatedAt: reply.updatedAt,
            author: {
              id: reply.authorId,
              displayName: getDisplayName(reply.authorId, nameMap),
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
      message: parsedParams.error.issues[0]?.message || 'groupId không hợp lệ',
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
      message: parsedBody.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
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
        message: 'Không tìm thấy nhóm cộng đồng',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (membership.status === 'FORBIDDEN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Bạn chưa tham gia nhóm này',
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
          imageUrl: parsedBody.data.imageUrl || null,
        },
        select: {
          id: true,
          authorId: true,
          content: true,
          imageUrl: true,
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

    // Resolve ten tac gia
    const nameMap = await resolveUserNames([post.authorId]);

    const response: ApiResponse<{
      id: string;
      content: string;
      imageUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
      author: {
        id: string;
        displayName: string;
      };
    }> = {
      success: true,
      code: 201,
      message: 'Đã đăng bài viết',
      data: {
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: {
          id: post.authorId,
          displayName: getDisplayName(post.authorId, nameMap),
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
      message: parsedParams.error.issues[0]?.message || 'Tham số không hợp lệ',
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
      message: parsedBody.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
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
        message: 'Không tìm thấy nhóm cộng đồng',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (membership.status === 'FORBIDDEN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: 'Bạn chưa tham gia nhóm này',
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
        message: 'Không tìm thấy bài viết trong nhóm này',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (parentPost.parentId) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Chỉ cho phép trả lời trực tiếp vào bài viết gốc',
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
          imageUrl: parsedBody.data.imageUrl || null,
        },
        select: {
          id: true,
          authorId: true,
          content: true,
          imageUrl: true,
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

    // Resolve ten tac gia
    const nameMap = await resolveUserNames([reply.authorId]);

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
      message: 'Đã gửi phản hồi',
      data: {
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: {
          id: reply.authorId,
          displayName: getDisplayName(reply.authorId, nameMap),
        },
      },
      trace_id: traceId,
    };

    return res.status(201).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'replyCommunityPost');
  }
}

/**
 * POST /api/admin/community/groups (admin-only)
 * Tao public community group
 */
export async function createPublicCommunityGroup(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  const parsedBody = createPublicGroupSchema.safeParse(req.body);
  if (!parsedBody.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedBody.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const group = await prisma.communityGroup.create({
      data: {
        type: 'PUBLIC',
        ownerId: userId,
        name: parsedBody.data.name,
        slug: parsedBody.data.slug,
        description: parsedBody.data.description || null,
      },
      select: {
        id: true,
        type: true,
        courseId: true,
        ownerId: true,
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
    });

    // Admin tu dong la thanh vien cua group vua tao
    await prisma.$transaction(async (tx) => {
      await tx.communityMember.create({
        data: { groupId: group.id, userId },
      });
      await tx.communityGroup.update({
        where: { id: group.id },
        data: { memberCount: { increment: 1 } },
      });
    });

    const response: ApiResponse<ReturnType<typeof mapGroupSummary>> = {
      success: true,
      code: 201,
      message: 'Đã tạo nhóm cộng đồng công khai',
      data: mapGroupSummary(group),
      trace_id: traceId,
    };

    return res.status(201).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'createPublicCommunityGroup');
  }
}
