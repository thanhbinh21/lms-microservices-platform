import type { Response } from 'express';

export function successResponse(
  res: Response,
  message: string,
  data: unknown,
  code = 200,
  traceId: string | null = null,
) {
  return res.status(code).json({
    success: true,
    code,
    message,
    data,
    trace_id: traceId,
  });
}

export function errorResponse(
  res: Response,
  message: string,
  code = 500,
  traceId: string | null = null,
) {
  return res.status(code).json({
    success: false,
    code,
    message,
    data: null,
    trace_id: traceId,
  });
}
