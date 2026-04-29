import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/index.js';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import { resolveUserNames, getDisplayName } from '../lib/community';

const listInstructorsQuerySchema = z.object({
  q: z.string().trim().optional(),
  sortBy: z.enum(['name', 'courses', 'rating']).default('name'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const listCoursesQuerySchema = z.object({
  q: z.string().trim().optional(),
  sortBy: z.enum(['newest', 'popular', 'rating', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
});

const socialLinksSchema = z.object({
  website: z.string().url().optional().or(z.literal('')),
  facebook: z.string().url().optional().or(z.literal('')),
  youtube: z.string().url().optional().or(z.literal('')),
  twitter: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
});

const instructorProfileSchema = z.object({
  displayName: z.string().trim().min(2, 'Ten hien thi toi thieu 2 ky tu').max(80, 'Ten hien thi toi da 80 ky tu'),
  headline: z.string().trim().max(160, 'Headline toi da 160 ky tu').optional().or(z.literal('')),
  bio: z.string().trim().max(3000, 'Gioi thieu toi da 3000 ky tu').optional().or(z.literal('')),
  avatar: z.string().url('URL anh khong hop le').optional().or(z.literal('')),
  slug: z.string().trim().max(100, 'Slug toi da 100 ky tu').optional().or(z.literal('')),
  socialLinks: socialLinksSchema.optional(),
});

const COURSE_SORT_MAP: Record<string, Prisma.CourseOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  popular: { enrollmentCount: 'desc' },
  rating: { averageRating: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
};

function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueInstructorSlug(baseSlug: string, excludeId?: string): Promise<string> {
  const base = normalizeSlug(baseSlug);
  if (!base) return base;

  const existing = await prisma.instructorProfile.findMany({
    where: {
      slug: { startsWith: base },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });

  const slugSet = new Set(existing.map((item) => item.slug));
  if (!slugSet.has(base)) {
    return base;
  }

  let counter = 1;
  while (slugSet.has(`${base}-${counter}`)) {
    counter += 1;
  }

  return `${base}-${counter}`;
}

function sanitizeSocialLinks(input?: z.infer<typeof socialLinksSchema>) {
  const links = input || {};
  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(links)) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed) {
      cleaned[key] = trimmed;
    }
  }

  return cleaned;
}

function mapCourseSummary(course: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  price: Prisma.Decimal;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  averageRating: number;
  ratingCount: number;
  enrollmentCount: number;
  createdAt: Date;
}) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    thumbnail: course.thumbnail,
    price: Number(course.price),
    level: course.level,
    averageRating: course.averageRating,
    ratingCount: course.ratingCount,
    enrollmentCount: course.enrollmentCount,
    createdAt: course.createdAt,
  };
}

async function ensureInstructorProfile(instructorId: string) {
  const existing = await prisma.instructorProfile.findUnique({ where: { instructorId } });
  if (existing) return existing;

  const nameMap = await resolveUserNames([instructorId]);
  const displayName = getDisplayName(instructorId, nameMap);
  const fallbackSlug = `giang-vien-${instructorId.slice(0, 8)}`;
  const baseSlug = normalizeSlug(displayName) || fallbackSlug;
  const slug = baseSlug ? await generateUniqueInstructorSlug(baseSlug) : fallbackSlug;

  return prisma.instructorProfile.create({
    data: {
      instructorId,
      displayName,
      slug,
      socialLinks: {},
    },
  });
}

/**
 * GET /api/instructors
 * Danh sach giang vien cong khai
 */
export async function listInstructors(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  const parsedQuery = listInstructorsQuerySchema.safeParse(req.query);
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

  try {
    const { q, sortBy, page, limit } = parsedQuery.data;

    const where: Prisma.InstructorProfileWhereInput = {};
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { headline: { contains: q, mode: 'insensitive' } },
      ];
    }

    const profiles = await prisma.instructorProfile.findMany({
      where,
      select: {
        id: true,
        instructorId: true,
        slug: true,
        displayName: true,
        headline: true,
        bio: true,
        avatar: true,
        socialLinks: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const instructorIds = profiles.map((profile) => profile.instructorId);
    const courseStats = instructorIds.length > 0
      ? await prisma.course.groupBy({
          by: ['instructorId'],
          where: { instructorId: { in: instructorIds }, status: 'PUBLISHED' },
          _count: { _all: true },
          _avg: { averageRating: true },
        })
      : [];

    const statsMap = new Map(
      courseStats.map((stat) => [
        stat.instructorId,
        {
          courseCount: stat._count._all,
          averageRating: stat._avg.averageRating ?? 0,
        },
      ]),
    );

    const items = profiles.map((profile) => {
      const stats = statsMap.get(profile.instructorId) || { courseCount: 0, averageRating: 0 };
      return {
        ...profile,
        courseCount: stats.courseCount,
        averageRating: Number(stats.averageRating.toFixed(2)),
      };
    });

    items.sort((a, b) => {
      if (sortBy === 'courses') {
        return b.courseCount - a.courseCount;
      }
      if (sortBy === 'rating') {
        return b.averageRating - a.averageRating;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    const total = items.length;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    const response: ApiResponse<{
      items: typeof paged;
      total: number;
      page: number;
      limit: number;
    }> = {
      success: true,
      code: 200,
      message: 'Danh sach giang vien',
      data: { items: paged, total, page, limit },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listInstructors');
  }
}

/**
 * GET /api/instructors/:slug
 * Ho so giang vien cong khai
 */
export async function getInstructorBySlug(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const slug = (req.params.slug || '').trim().toLowerCase();

  if (!slug) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: 'Slug khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const profile = await prisma.instructorProfile.findUnique({
      where: { slug },
      select: {
        id: true,
        instructorId: true,
        slug: true,
        displayName: true,
        headline: true,
        bio: true,
        avatar: true,
        socialLinks: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Khong tim thay giang vien',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const [courseStats, courses] = await prisma.$transaction([
      prisma.course.aggregate({
        where: { instructorId: profile.instructorId, status: 'PUBLISHED' },
        _avg: { averageRating: true },
        _count: { id: true },
      }),
      prisma.course.findMany({
        where: { instructorId: profile.instructorId, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          thumbnail: true,
          price: true,
          level: true,
          averageRating: true,
          ratingCount: true,
          enrollmentCount: true,
          createdAt: true,
        },
      }),
    ]);

    const response: ApiResponse<{
      profile: typeof profile;
      courseCount: number;
      averageRating: number;
      courses: Array<ReturnType<typeof mapCourseSummary>>;
    }> = {
      success: true,
      code: 200,
      message: 'Ho so giang vien',
      data: {
        profile,
        courseCount: courseStats._count.id,
        averageRating: Number((courseStats._avg.averageRating ?? 0).toFixed(2)),
        courses: courses.map(mapCourseSummary),
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getInstructorBySlug');
  }
}

/**
 * GET /api/instructors/:slug/courses
 * Danh sach khoa hoc cong khai cua giang vien
 */
export async function listInstructorCoursesBySlug(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const slug = (req.params.slug || '').trim().toLowerCase();

  if (!slug) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: 'Slug khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  const parsedQuery = listCoursesQuerySchema.safeParse(req.query);
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

  try {
    const profile = await prisma.instructorProfile.findUnique({
      where: { slug },
      select: { instructorId: true },
    });

    if (!profile) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Khong tim thay giang vien',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const { q, sortBy, page, limit, level, minPrice, maxPrice } = parsedQuery.data;
    const where: Prisma.CourseWhereInput = {
      instructorId: profile.instructorId,
      status: 'PUBLISHED',
    };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (level) {
      where.level = level;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }

    const [total, courses] = await prisma.$transaction([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        orderBy: COURSE_SORT_MAP[sortBy],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          thumbnail: true,
          price: true,
          level: true,
          averageRating: true,
          ratingCount: true,
          enrollmentCount: true,
          createdAt: true,
        },
      }),
    ]);

    const response: ApiResponse<{
      items: Array<ReturnType<typeof mapCourseSummary>>;
      total: number;
      page: number;
      limit: number;
    }> = {
      success: true,
      code: 200,
      message: 'Danh sach khoa hoc giang vien',
      data: {
        items: courses.map(mapCourseSummary),
        total,
        page,
        limit,
      },
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listInstructorCoursesBySlug');
  }
}

/**
 * GET /api/instructors/profile
 * Lay ho so cua giang vien hien tai
 */
export async function getMyInstructorProfile(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;

  try {
    const profile = await ensureInstructorProfile(userId);

    const response: ApiResponse<typeof profile> = {
      success: true,
      code: 200,
      message: 'Ho so giang vien',
      data: profile,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getMyInstructorProfile');
  }
}

/**
 * PUT /api/instructors/profile
 * Cap nhat ho so giang vien
 */
export async function updateMyInstructorProfile(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;

  const parsedBody = instructorProfileSchema.safeParse(req.body);
  if (!parsedBody.success) {
    const response: ApiResponse<null> = {
      success: false,
      code: 400,
      message: parsedBody.error.issues[0]?.message || 'Du lieu khong hop le',
      data: null,
      trace_id: traceId,
    };
    return res.status(400).json(response);
  }

  try {
    const data = parsedBody.data;
    const existing = await prisma.instructorProfile.findUnique({ where: { instructorId: userId } });

    const requestedSlug = data.slug?.trim() || '';
    const normalizedSlug = requestedSlug ? normalizeSlug(requestedSlug) : '';

    let finalSlug = existing?.slug || '';
    if (normalizedSlug) {
      if (!existing || normalizedSlug !== existing.slug) {
        const conflict = await prisma.instructorProfile.findUnique({ where: { slug: normalizedSlug } });
        if (conflict) {
          const response: ApiResponse<null> = {
            success: false,
            code: 409,
            message: 'Slug da ton tai',
            data: null,
            trace_id: traceId,
          };
          return res.status(409).json(response);
        }
        finalSlug = normalizedSlug;
      }
    } else if (!existing) {
      const baseSlug = normalizeSlug(data.displayName) || `giang-vien-${userId.slice(0, 8)}`;
      finalSlug = await generateUniqueInstructorSlug(baseSlug);
    }

    const profile = await prisma.instructorProfile.upsert({
      where: { instructorId: userId },
      update: {
        displayName: data.displayName.trim(),
        headline: data.headline?.trim() || null,
        bio: data.bio?.trim() || null,
        avatar: data.avatar?.trim() || null,
        slug: finalSlug || existing?.slug || `giang-vien-${userId.slice(0, 8)}`,
        socialLinks: sanitizeSocialLinks(data.socialLinks),
      },
      create: {
        instructorId: userId,
        displayName: data.displayName.trim(),
        headline: data.headline?.trim() || null,
        bio: data.bio?.trim() || null,
        avatar: data.avatar?.trim() || null,
        slug: finalSlug || `giang-vien-${userId.slice(0, 8)}`,
        socialLinks: sanitizeSocialLinks(data.socialLinks),
      },
    });

    const response: ApiResponse<typeof profile> = {
      success: true,
      code: 200,
      message: 'Cap nhat ho so thanh cong',
      data: profile,
      trace_id: traceId,
    };

    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'updateMyInstructorProfile');
  }
}
