import type { Response } from 'express';
import { createSuccessResponse, createErrorResponse } from '@lms/types';

export function successResponse(
  res: Response,
  message: string,
  data: unknown,
  code = 200,
  traceId: string | null = null,
) {
  return res.status(code).json(createSuccessResponse(data, message, traceId || '', code));
}

export function errorResponse(
  res: Response,
  message: string,
  code = 500,
  traceId: string | null = null,
) {
  return res.status(code).json(createErrorResponse(message, code, traceId || ''));
}
