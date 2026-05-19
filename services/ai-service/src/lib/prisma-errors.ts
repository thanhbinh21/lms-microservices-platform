import { Response } from 'express';
import { Prisma } from '../generated/prisma/index.js';
import { logger } from './logger.js';
import type { ApiResponse } from '@lms/types';

export function handlePrismaError(
  err: unknown,
  res: Response,
  traceId: string,
  context: string,
): Response {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ err }, `${context} error`);
    const unavailable: ApiResponse<null> = {
      success: false,
      code: 503,
      message: 'Database temporarily unavailable',
      data: null,
      trace_id: traceId,
    };
    return res.status(503).json(unavailable);
  }

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
      default:
        break;
    }
  }

  logger.error({ err }, `${context} error`);
  const serverError: ApiResponse<null> = {
    success: false,
    code: 500,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : `${context}: ${(err as Error)?.message || 'Unknown error'}`,
    data: null,
    trace_id: traceId,
  };
  return res.status(500).json(serverError);
}
