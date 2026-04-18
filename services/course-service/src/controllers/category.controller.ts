import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';

const createCategorySchema = z.object({
  name: z.string().min(2, 'Ten danh muc toi thieu 2 ky tu'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug chi chua chu thuong, so va dau gach ngang'),
  order: z.number().int().min(0).default(0),
});

/** GET /api/categories */
export async function listCategories(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { courses: { where: { status: 'PUBLISHED' } } },
        },
      },
      orderBy: { order: 'asc' },
    });

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

    const category = await prisma.category.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        order: validated.order,
      },
    });

    const response: ApiResponse<unknown> = {
      success: true,
      code: 201,
      message: 'Category created',
      data: category,
      trace_id: traceId,
    };
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
