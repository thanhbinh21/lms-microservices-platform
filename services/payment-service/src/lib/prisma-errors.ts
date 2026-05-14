import { Response } from 'express';
import { Prisma } from '../generated/prisma';
import type { ApiResponse } from '@lms/types';

export function handlePrismaError(
  err: unknown,
  res: Response,
  traceId: string,
  context: string,
): Response {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2025':
        return res.status(404).json({
          success: false,
          code: 404,
          message: 'Record not found',
          data: null,
          trace_id: traceId,
        } as ApiResponse<null>);
      case 'P2002':
        return res.status(409).json({
          success: false,
          code: 409,
          message: 'Conflict',
          data: null,
          trace_id: traceId,
        } as ApiResponse<null>);
      case 'P2003':
        return res.status(400).json({
          success: false,
          code: 400,
          message: 'Invalid reference',
          data: null,
          trace_id: traceId,
        } as ApiResponse<null>);
      default:
        break;
    }
  }

  return res.status(500).json({
    success: false,
    code: 500,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : `${context}: ${(err as Error)?.message || 'Unknown error'}`,
    data: null,
    trace_id: traceId,
  } as ApiResponse<null>);
}
