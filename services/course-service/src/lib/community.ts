import { Prisma } from '../generated/prisma/index.js';
import prisma from './prisma';
import { logger } from '@lms/logger';

// Cache ten nguoi dung de giam goi auth-service (TTL 5 phut)
const userNameCache = new Map<string, { name: string; username: string | null; expiresAt: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 phut

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3101';

type CommunityGroupWithCourse = {
  id: string;
  type: 'PUBLIC' | 'COURSE_PRIVATE';
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
};

type MembershipResult =
  | { status: 'NOT_FOUND'; group: null; memberCreated: false }
  | { status: 'FORBIDDEN'; group: CommunityGroupWithCourse; memberCreated: false }
  | { status: 'READY'; group: CommunityGroupWithCourse; memberCreated: boolean };

const GROUP_SELECT = {
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
} as const;

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildGroupSlug(courseSlug: string, courseId: string): string {
  const normalizedCourseSlug = normalizeSlug(courseSlug) || 'course';
  return `community-${normalizedCourseSlug}-${courseId.slice(0, 8)}`;
}

// Goi auth-service de lay name + username theo batch userId
export async function resolveUserNames(
  userIds: string[],
): Promise<Map<string, { name: string; username: string | null }>> {
  const result = new Map<string, { name: string; username: string | null }>();
  const uncachedIds: string[] = [];

  const now = Date.now();
  for (const id of userIds) {
    const cached = userNameCache.get(id);
    if (cached && cached.expiresAt > now) {
      result.set(id, { name: cached.name, username: cached.username });
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length === 0) return result;

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/internal/users/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': 'true',
      },
      body: JSON.stringify({ userIds: uncachedIds }),
    });

    if (response.ok) {
      const json = (await response.json()) as any;
      const usersMap = json?.data?.users as Record<string, { name: string; username: string | null }> | undefined;

      if (usersMap) {
        for (const [id, info] of Object.entries(usersMap)) {
          result.set(id, info);
          userNameCache.set(id, { ...info, expiresAt: now + USER_CACHE_TTL });
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Khong the goi auth-service batch user — fallback displayName');
  }

  return result;
}

// Tra ve displayName cho 1 userId, uu tien name > username > fallback
export function getDisplayName(
  userId: string,
  nameMap: Map<string, { name: string; username: string | null }>,
): string {
  const info = nameMap.get(userId);
  if (info) {
    return info.name || info.username || `Người dùng #${userId.slice(0, 6)}`;
  }
  return `Người dùng #${userId.slice(0, 6)}`;
}

// Upsert private community group cho 1 khoa hoc (enrollment-driven)
async function upsertCoursePrivateGroup(
  tx: Prisma.TransactionClient,
  courseId: string,
): Promise<CommunityGroupWithCourse> {
  const course = await tx.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      slug: true,
      thumbnail: true,
      level: true,
      instructorId: true,
    },
  });

  if (!course) {
    throw new Error('Không tìm thấy khóa học để tạo nhóm thảo luận');
  }

  const group = await tx.communityGroup.upsert({
    where: { courseId },
    create: {
      type: 'COURSE_PRIVATE',
      courseId,
      ownerId: course.instructorId,
      name: `Thảo luận: ${course.title}`,
      slug: buildGroupSlug(course.slug, course.id),
      description: `Nhóm trao đổi dành cho học viên khóa học "${course.title}"`,
    },
    update: {
      // Dong bo ten nhom theo ten khoa hoc de nguoi hoc de nhan dien
      name: `Thảo luận: ${course.title}`,
      ownerId: course.instructorId,
    },
    select: GROUP_SELECT,
  });

  return group as CommunityGroupWithCourse;
}

// Dam bao user la thanh vien cua private group (enrollment-based)
export async function ensureCommunityMembershipForCourse(params: {
  userId: string;
  courseId: string;
}): Promise<{ group: CommunityGroupWithCourse; memberCreated: boolean }> {
  const { userId, courseId } = params;

  return prisma.$transaction(async (tx) => {
    const group = await upsertCoursePrivateGroup(tx, courseId);

    const existed = await tx.communityMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId,
        },
      },
      select: { id: true },
    });

    if (existed) {
      return { group, memberCreated: false };
    }

    try {
      await tx.communityMember.create({
        data: {
          groupId: group.id,
          userId,
        },
      });
    } catch (err) {
      // Race condition: member da duoc tao giua luc check va create
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { group, memberCreated: false };
      }
      throw err;
    }

    const updatedGroup = await tx.communityGroup.update({
      where: { id: group.id },
      data: { memberCount: { increment: 1 } },
      select: GROUP_SELECT,
    });

    return {
      group: updatedGroup as CommunityGroupWithCourse,
      memberCreated: true,
    };
  });
}

// Kiem tra va dam bao membership khi user truy cap group (ca public va private)
export async function ensureCommunityMembershipByGroup(params: {
  userId: string;
  groupId: string;
}): Promise<MembershipResult> {
  const { userId, groupId } = params;

  const group = await prisma.communityGroup.findUnique({
    where: { id: groupId },
    select: GROUP_SELECT,
  });

  if (!group) {
    return { status: 'NOT_FOUND', group: null, memberCreated: false };
  }

  // Kiem tra da la thanh vien chua
  const existed = await prisma.communityMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
    select: { id: true },
  });

  if (existed) {
    return {
      status: 'READY',
      group: group as CommunityGroupWithCourse,
      memberCreated: false,
    };
  }

  // PUBLIC: bat ky user nao cung duoc join
  if (group.type === 'PUBLIC') {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.communityMember.create({
          data: { groupId, userId },
        });
        await tx.communityGroup.update({
          where: { id: groupId },
          data: { memberCount: { increment: 1 } },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Da join trong race condition
      } else {
        throw err;
      }
    }

    const refreshed = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      select: GROUP_SELECT,
    });

    return {
      status: 'READY',
      group: (refreshed ?? group) as CommunityGroupWithCourse,
      memberCreated: true,
    };
  }

  // COURSE_PRIVATE: chi enrolled user moi duoc join
  if (!group.courseId) {
    return {
      status: 'FORBIDDEN',
      group: group as CommunityGroupWithCourse,
      memberCreated: false,
    };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId: group.courseId,
      },
    },
    select: { id: true },
  });

  if (!enrollment) {
    return {
      status: 'FORBIDDEN',
      group: group as CommunityGroupWithCourse,
      memberCreated: false,
    };
  }

  // User da enroll, auto-join
  const joined = await ensureCommunityMembershipForCourse({
    userId,
    courseId: group.courseId,
  });

  return {
    status: 'READY',
    group: joined.group,
    memberCreated: joined.memberCreated,
  };
}

// Backfill: dam bao user co membership cho moi khoa hoc da enroll (chay khi list groups)
export async function backfillCommunityMembershipByEnrollment(userId: string): Promise<void> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true },
  });

  for (const enrollment of enrollments) {
    try {
      await ensureCommunityMembershipForCourse({
        userId,
        courseId: enrollment.courseId,
      });
    } catch {
      // Khong throw de 1 khoa hoc loi khong lam fail ca dashboard/community list
    }
  }
}
