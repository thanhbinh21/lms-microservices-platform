import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import { createRequireInternal, type ApiResponse } from '@lms/types';
import { initRedis, closeRedis } from './lib/redis.js';
import { initEnv } from './lib/env.js';
import prisma from './lib/prisma.js';
import { register } from './controllers/register.controller.js';
import { login } from './controllers/login.controller.js';
import { refresh } from './controllers/refresh.controller.js';
import { logout } from './controllers/logout.controller.js';
import { updateUserRole } from './controllers/update-role.controller.js';
import { becomeEducator } from './controllers/become-educator.controller.js';
import { requireAdmin } from './middleware/require-admin.js';
import { requireAuth } from './middleware/require-auth.js';
import { getInternalUser, getInternalUsersBatch, getInternalInstructors, getInternalAdmins } from './controllers/internal.controller.js';
import { createAuditLog } from './controllers/audit.controller.js';
import adminRouter from './routes/admin.routes.js';
import { startCleanupJobs } from './jobs/cleanup.js';
import {
  createInstructorRequest,
  getMyInstructorRequest,
  listInstructorRequests,
  getInstructorRequestStats,
  getInstructorRequestById,
  approveInstructorRequest,
  rejectInstructorRequest,
} from './controllers/instructor-request.controller.js';
import {
  createSupportTicket,
  getSupportTicket,
  listMySupportTickets,
  replySupportTicket,
} from './controllers/support.controller.js';

// Validate bien moi truong khi khoi dong
const env = initEnv();

const app = express();
const PORT = process.env.PORT || 3101;
let server: ReturnType<typeof app.listen> | null = null;
let shuttingDown = false;
const requireInternal = createRequireInternal({ internalSecret: env.INTERNAL_SERVICE_SECRET });

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
  const response: ApiResponse<{ service: string; status: string; timestamp: string }> = {
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
app.post('/become-educator', becomeEducator);
app.patch('/users/role', requireAdmin, updateUserRole);

// Routes don xin tro thanh giang vien (merge tu instructor-service)
app.post('/instructor/request', requireAuth, createInstructorRequest);
app.get('/instructor/my-request', requireAuth, getMyInstructorRequest);
app.get('/admin/instructor/requests/stats', requireAdmin, getInstructorRequestStats);
app.get('/admin/instructor/requests', requireAdmin, listInstructorRequests);
app.get('/admin/instructor/requests/:id', requireAdmin, getInstructorRequestById);
app.put('/admin/instructor/approve/:id', requireAdmin, approveInstructorRequest);
app.put('/admin/instructor/reject/:id', requireAdmin, rejectInstructorRequest);

// Routes ho tro nguoi dung
app.post('/support/tickets', requireAuth, createSupportTicket);
app.get('/support/tickets/my', requireAuth, listMySupportTickets);
app.get('/support/tickets/:id', requireAuth, getSupportTicket);
app.post('/support/tickets/:id/replies', requireAuth, replySupportTicket);

// Internal routes (khong qua Gateway)
app.get('/internal/users/:id', requireInternal, getInternalUser);
app.post('/internal/users/batch', requireInternal, getInternalUsersBatch);
app.get('/internal/instructors', requireInternal, getInternalInstructors);
app.get('/internal/admins', requireInternal, getInternalAdmins);
app.post('/internal/audit-logs', requireInternal, createAuditLog);

// Admin routes
app.use('/admin', requireAdmin, adminRouter);

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
    startCleanupJobs();

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
