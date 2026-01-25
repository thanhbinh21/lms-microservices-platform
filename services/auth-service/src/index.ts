import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import { validateAuthServiceEnv } from '@lms/env-validator';
import type { ApiResponse } from '@lms/types';
import { initRedis, closeRedis } from './lib/redis.js';
import { register } from './controllers/register.controller.js';
import { login } from './controllers/login.controller.js';
import { refresh } from './controllers/refresh.controller.js';
import { logout } from './controllers/logout.controller.js';

// Validate environment variables
const env = validateAuthServiceEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    traceId: req.headers['x-trace-id'],
  }, 'Incoming request');
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  const response: ApiResponse<any> = {
    success: true,
    code: 200,
    message: 'Auth Service is healthy',
    data: {
      service: 'auth-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    trace_id: req.headers['x-trace-id'] as string || 'health-check',
  };
  res.json(response);
});

// Auth routes
app.post('/register', register);
app.post('/login', login);
app.post('/refresh', refresh);
app.post('/logout', logout);

// 404 handler
app.use((req: Request, res: Response) => {
  const response: ApiResponse<null> = {
    success: false,
    code: 404,
    message: `Route ${req.method} ${req.path} not found`,
    data: null,
    trace_id: req.headers['x-trace-id'] as string || 'unknown',
  };
  res.status(404).json(response);
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, traceId: req.headers['x-trace-id'] }, 'Unhandled error');

  const response: ApiResponse<null> = {
    success: false,
    code: 500,
    message: 'Internal server error',
    data: null,
    trace_id: req.headers['x-trace-id'] as string || 'error',
  };
  res.status(500).json(response);
});

// Start server
async function startServer() {
  try {
    // Initialize Redis
    await initRedis(env.REDIS_URL);

    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Auth Service started successfully');
      logger.info('Environment: ' + env.NODE_ENV);
      logger.info('Database: Connected to Neon PostgreSQL');
      logger.info('Redis: Connected for session storage');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start Auth Service');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down Auth Service...');
  await closeRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down Auth Service...');
  await closeRedis();
  process.exit(0);
});

startServer();
