import { Prisma } from '../generated/prisma/index.js';
import prisma from './prisma';

type CommunityGroupWithCourse = {
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
};

type MembershipResult =
  | { status: 'NOT_FOUND'; group: null; memberCreated: false }
  | { status: 'FORBIDDEN'; group: CommunityGroupWithCourse; memberCreated: false }
  | { status: 'READY'; group: CommunityGroupWithCourse; memberCreated: boolean };

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

async function upsertCommunityGroupByCourseId(
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
    },
  });

  if (!course) {
    throw new Error('Course not found for community group');
  }

  const group = await tx.communityGroup.upsert({
    where: { courseId },
    create: {
      courseId,
      name: `Thao luan: ${course.title}`,
      slug: buildGroupSlug(course.slug, course.id),
      description: `Nhom trao doi cho khoa hoc ${course.title}`,
    },
    update: {
      // Dong bo ten nhom theo ten khoa hoc de nguoi hoc de nhan dien.
      name: `Thao luan: ${course.title}`,
    },
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
  });

  return group;
}

export async function ensureCommunityMembershipForCourse(params: {
  userId: string;
  courseId: string;
}): Promise<{ group: CommunityGroupWithCourse; memberCreated: boolean }> {
  const { userId, courseId } = params;

  return prisma.$transaction(async (tx) => {
    const group = await upsertCommunityGroupByCourseId(tx, courseId);

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
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { group, memberCreated: false };
      }
      throw err;
    }

    const updatedGroup = await tx.communityGroup.update({
      where: { id: group.id },
      data: { memberCount: { increment: 1 } },
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
    });

    return {
      group: updatedGroup,
      memberCreated: true,
    };
  });
}

export async function ensureCommunityMembershipByGroup(params: {
  userId: string;
  groupId: string;
}): Promise<MembershipResult> {
  const { userId, groupId } = params;

  const group = await prisma.communityGroup.findUnique({
    where: { id: groupId },
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
  });

  if (!group) {
    return { status: 'NOT_FOUND', group: null, memberCreated: false };
  }

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
      group,
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
      group,
      memberCreated: false,
    };
  }

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
      // Khong throw de 1 khoa hoc loi khong lam fail ca dashboard/community list.
    }
  }
}
