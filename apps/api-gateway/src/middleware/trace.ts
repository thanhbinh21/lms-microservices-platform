import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '@lms/logger';

export const traceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const trace_id = req.headers['x-trace-id'] || randomUUID();
  (req as any).trace_id = trace_id;

  // Add trace_id to response headers
  res.setHeader('x-trace-id', trace_id as string);

  logger.info(
    {
      trace_id,
      method: req.method,
      path: req.path,
      ip: req.ip,
    },
    'Incoming request'
  );

  next();
};
