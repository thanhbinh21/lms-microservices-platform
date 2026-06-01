import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { handlePrismaError } from '../lib/prisma-errors.js';
import { cacheGet, cacheInvalidate, cacheInvalidatePattern } from '@lms/cache';
import { writeAuditLog } from '../lib/audit.js';
import { publishCourseCatalogEvent } from '../lib/course-catalog-events.js';

const createCategorySchema = z.object({
  name: z.string().min(2, 'Ten danh muc toi thieu 2 ky tu'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug chi chua chu thuong, so va dau gach ngang').optional(),
  order: z.number().int().min(0).default(0),
});

const updateCategorySchema = z.object({
  name: z.string().min(2, 'Ten danh muc toi thieu 2 ky tu').optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug chi chua chu thuong, so va dau gach ngang').optional(),
  order: z.number().int().min(0).optional(),
}).refine((value) => Boolean(value.name || value.slug || value.order !== undefined), {
  message: 'At least one field is required',
});

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function invalidateCategoryRelatedCaches(): Promise<void> {
  await Promise.all([
    cacheInvalidate('cache:categories:all'),
    cacheInvalidatePattern('cache:courses:list:*'),
  ]);
}

async function generateUniqueCategorySlug(name: string): Promise<string> {
  const base = normalizeSlug(name);
  const existing = await prisma.category.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  const existingSet = new Set(existing.map((item) => item.slug));
  if (!existingSet.has(base)) {
    return base;
  }

  let counter = 1;
  while (existingSet.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

/** GET /api/categories */
export async function listCategories(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const categories = await cacheGet(
      'cache:categories:all',
      () => prisma.category.findMany({
        include: { _count: { select: { courses: { where: { status: 'PUBLISHED' } } } } },
        orderBy: { order: 'asc' },
      }),
      600,
    );

    const data = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      order: c.order,
      courseCount: c._count.courses,
    }));

    const response: ApiResponse<unknown> = {
      success: true,
      code: 200,
      message: 'Categories fetched',
      data,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'listCategories');
  }
}

/** POST /api/admin/categories — admin only */
export async function createCategory(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const validated = createCategorySchema.parse(req.body);

    const slugInput = validated.slug?.trim();
    const normalizedSlug = slugInput ? normalizeSlug(slugInput) : '';

    if (normalizedSlug) {
      const existedSlug = await prisma.category.findUnique({ where: { slug: normalizedSlug } });
      if (existedSlug) {
        const conflict: ApiResponse<null> = {
          success: false,
          code: 409,
          message: 'Slug da ton tai',
          data: null,
          trace_id: traceId,
        };
        return res.status(409).json(conflict);
      }
    }

    const category = await prisma.category.create({
      data: {
        name: validated.name,
        slug: normalizedSlug || (await generateUniqueCategorySlug(validated.name)),
        order: validated.order,
      },
    });

    await writeAuditLog({
      actorId: res.locals.userId as string,
      actorRole: 'ADMIN',
      action: 'CATEGORY_CREATED',
      resourceType: 'CATEGORY',
      resourceId: category.id,
      targetLabel: category.name,
      payload: category,
      traceId,
    });

    const response: ApiResponse<unknown> = {
      success: true,
      code: 201,
      message: 'Category created',
      data: category,
      trace_id: traceId,
    };
    // Danh muc thay doi anh huong sidebar + course list filter.
    await invalidateCategoryRelatedCaches();
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0].message,
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'createCategory');
  }
}

/** PATCH /api/admin/categories/:id — admin only */
export async function updateCategory(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const { id } = req.params;
    const validated = updateCategorySchema.parse(req.body);

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Category not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const slugInput = validated.slug?.trim();
    const normalizedSlug = slugInput ? normalizeSlug(slugInput) : undefined;

    if (normalizedSlug && normalizedSlug !== existing.slug) {
      const conflict = await prisma.category.findUnique({ where: { slug: normalizedSlug } });
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
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(validated.name ? { name: validated.name } : {}),
        ...(normalizedSlug ? { slug: normalizedSlug } : {}),
        ...(validated.order !== undefined ? { order: validated.order } : {}),
      },
    });

    await writeAuditLog({
      actorId: res.locals.userId as string,
      actorRole: 'ADMIN',
      action: 'CATEGORY_UPDATED',
      resourceType: 'CATEGORY',
      resourceId: category.id,
      targetLabel: category.name,
      payload: { before: existing, after: category },
      traceId,
    });

    await invalidateCategoryRelatedCaches();
    if (category.name !== existing.name || category.slug !== existing.slug) {
      const affectedCourses = await prisma.course.findMany({
        where: { categoryId: id, status: 'PUBLISHED' },
        select: { id: true },
      });
      await Promise.all(
        affectedCourses.map((course) => publishCourseCatalogEvent(course.id, 'updated', traceId)),
      );
    }

    const response: ApiResponse<typeof category> = {
      success: true,
      code: 200,
      message: 'Category updated',
      data: category,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0].message,
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'updateCategory');
  }
}

/** DELETE /api/admin/categories/:id — admin only */
export async function deleteCategory(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const { id } = req.params;

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { courses: true } } },
    });

    if (!existing) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Category not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    if (existing._count.courses > 0) {
      const response: ApiResponse<null> = {
        success: false,
        code: 409,
        message: 'Cannot delete category that still has courses',
        data: null,
        trace_id: traceId,
      };
      return res.status(409).json(response);
    }

    await prisma.category.delete({ where: { id } });

    await writeAuditLog({
      actorId: res.locals.userId as string,
      actorRole: 'ADMIN',
      action: 'CATEGORY_DELETED',
      resourceType: 'CATEGORY',
      resourceId: existing.id,
      targetLabel: existing.name,
      payload: existing,
      traceId,
    });

    await invalidateCategoryRelatedCaches();

    const response: ApiResponse<null> = {
      success: true,
      code: 200,
      message: 'Category deleted',
      data: null,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteCategory');
  }
}
