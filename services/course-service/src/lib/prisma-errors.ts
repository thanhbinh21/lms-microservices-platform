import { Response } from 'express';
import { Prisma } from '../generated/prisma';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';

/**
 * Xu ly loi Prisma tap trung.
 * Chuyen ma loi Prisma thanh HTTP response phu hop.
 *
 * P2002 - Vi pham rang buoc unique (slug, email da ton tai)
 * P2025 - Khong tim thay ban ghi
 * P2003 - Vi pham khoa ngoai
 */
export function handlePrismaError(
  err: unknown,
  res: Response,
  traceId: string,
  context: string,
): Response {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const fields = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        const conflict: ApiResponse<null> = {
          success: false,
          code: 409,
          message: `Conflict: ${fields} already exists`,
          data: null,
          trace_id: traceId,
        };
        return res.status(409).json(conflict);
      }
      case 'P2025':
        const notFound: ApiResponse<null> = {
          success: false,
          code: 404,
          message: 'Record not found',
          data: null,
          trace_id: traceId,
        };
        return res.status(404).json(notFound);
      case 'P2003':
        const badRef: ApiResponse<null> = {
          success: false,
          code: 400,
          message: 'Invalid reference — related record does not exist',
          data: null,
          trace_id: traceId,
        };
        return res.status(400).json(badRef);
      default:
        break;
    }
  }

  logger.error({ err }, `${context} error`);
  const serverError: ApiResponse<null> = {
    success: false,
    code: 500,
    message: 'Internal server error',
    data: null,
    trace_id: traceId,
  };
  return res.status(500).json(serverError);
}
