import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { logger } from '@lms/logger';

/**
 * Endpoints noi bo — chi cho cac service khac trong cluster goi truc tiep
 * (khong di qua Kong). Phat hien bang header `x-internal-call`.
 *
 * Payment-service dung endpoint nay de verify price (chong client tampering).
 */

function ensureInternal(req: Request, res: Response): boolean {
  const hdr = (req.headers['x-internal-call'] as string) || '';
  if (!hdr) {
    const response: ApiResponse<null> = {
      success: false,
      code: 403,
      message: 'Internal endpoint',
      data: null,
      trace_id: (req.headers['x-trace-id'] as string) || '',
    };
    res.status(403).json(response);
    return false;
  }
  return true;
}

/**
 * GET /internal/courses/:id — tra ve thong tin toi thieu de tinh gia.
 */
export const getCourseByIdInternal = async (req: Request, res: Response): Promise<Response | void> => {
  if (!ensureInternal(req, res)) return;

  const traceId = (req.headers['x-trace-id'] as string) || '';
  const { id } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        status: true,
        instructorId: true,
      },
    });

    if (!course) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Course not found',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof course & { price: number }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { ...course, price: course.price.toNumber() },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, id }, 'getCourseByIdInternal error');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Internal Server Error',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
};
