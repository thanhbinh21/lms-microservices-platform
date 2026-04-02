import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import { initRedis, closeRedis } from './lib/redis.js';
import { initEnv } from './lib/env.js';
import prisma from './lib/prisma.js';
import { register } from './controllers/register.controller.js';
import { login } from './controllers/login.controller.js';
import { refresh } from './controllers/refresh.controller.js';
import { logout } from './controllers/logout.controller.js';
import { updateUserRole } from './controllers/update-role.controller.js';

// Validate bien moi truong khi khoi dong
const env = initEnv();

const app = express();
const PORT = process.env.PORT || 3001;
let server: ReturnType<typeof app.listen> | null = null;
let shuttingDown = false;

// Middleware bao mat
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Ghi log request
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    traceId: req.headers['x-trace-id'],
  }, 'Incoming request');
  next();
});

// Kiem tra suc khoe
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

// Routes xac thuc
app.post('/register', register);
app.post('/login', login);
app.post('/refresh', refresh);
app.post('/logout', logout);
app.patch('/users/role', updateUserRole);

// Xu ly 404
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

// Xu ly loi toan cuc
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, traceId: req.headers['x-trace-id'] }, 'Loi khong xu ly');

  const response: ApiResponse<null> = {
    success: false,
    code: 500,
    message: 'Internal server error',
    data: null,
    trace_id: req.headers['x-trace-id'] as string || 'error',
  };
  res.status(500).json(response);
});

// Khoi dong server
async function startServer() {
  try {
    // Ket noi Redis
    await initRedis(env.REDIS_URL);

    server = app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Auth Service da khoi dong');
    });
  } catch (error) {
    logger.error({ error }, 'Khoi dong Auth Service that bai');
    process.exit(1);
  }
}

// Tat server an toan de tranh mat request dang xu ly va ro ri ket noi
async function shutdown(signal: 'SIGINT' | 'SIGTERM') {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info({ signal }, 'Dang tat Auth Service...');

  const forceExitTimer = setTimeout(() => {
    logger.error({ signal }, 'Auth Service shutdown timeout, force exit');
    process.exit(1);
  }, 10_000);

  try {
    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
    }

    await closeRedis();
    await prisma.$disconnect();

    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    logger.error({ error, signal }, 'Loi khi tat Auth Service');
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

startServer();
