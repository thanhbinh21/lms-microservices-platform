import { Request, Response, NextFunction } from 'express';
import logger from '@lms/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const trace_id = (req as any).trace_id || 'unknown';

  logger.error(
    {
      error: err.message,
      stack: err.stack,
      trace_id,
      path: req.path,
    },
    'Gateway error occurred'
  );

  res.status(err.status || 500).json({
    success: false,
    code: err.status || 500,
    message: err.message || 'Internal Server Error',
    data: null,
    trace_id,
  });
};
