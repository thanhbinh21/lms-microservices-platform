import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import { requireAuth, requireRole } from './middleware/require-auth.js';
import {
  enrollCourse,
  getMyEnrollments,
  checkEnrollmentStatus,
} from './controllers/enrollment.controller.js';
import {
  getLearnData,
  completeLesson,
  updateLessonProgress,
  getMyCertificates,
  getCertificateByNumber,
  getCourseProgress,
  internalCheckEnrollment,
  internalGetCourseCompletion,
} from './controllers/learning.controller.js';
import {
  listFailedEvents,
  getFailedEventStats,
  getFailedEvent,
  retryFailedEvent,
  resolveFailedEvent,
} from './controllers/dlq.controller.js';
import { startKafkaConsumers } from './lib/kafka-consumer.js';
import prisma from './lib/prisma.js';

// Validate bien moi truong can thiet
const requiredEnvVars = ['DATABASE_URL', 'COURSE_SERVICE_URL'] as const;
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    logger.error({ key }, '[learning-service] Missing required env var');
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT || '3006', 10);
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Lay userId/userRole tu Kong Gateway headers
app.use((req, _res, next) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  const userRole = req.headers['x-user-role'] as string | undefined;
  if (userId) {
    _res.locals.userId = userId;
    _res.locals.userRole = (userRole || '').toLowerCase();
  }
  next();
});

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'learning-service', port: PORT });
});

// ─── Enrollment Routes ───────────────────────────────────────────────────────

// Ghi danh khoa hoc mien phi
app.post('/api/courses/:courseId/enroll', requireAuth, enrollCourse);
// Lay danh sach khoa hoc da ghi danh
app.get('/api/my-enrollments', requireAuth, getMyEnrollments);
// Kiem tra trang thai ghi danh
app.get('/api/courses/:courseId/enrollment-status', requireAuth, checkEnrollmentStatus);

// ─── Learning / Progress Routes ──────────────────────────────────────────────

// Lay du lieu hoc tap cho 1 khoa hoc
app.get('/api/learn/:courseId', requireAuth, getLearnData);
// Lay tien do hoc tap theo khoa hoc
app.get('/api/courses/:courseId/progress', requireAuth, getCourseProgress);
// Danh dau bai hoc hoan thanh
app.post('/api/lessons/:lessonId/complete', requireAuth, completeLesson);
// Cap nhat tien do xem video
app.post('/api/lessons/:lessonId/progress', requireAuth, updateLessonProgress);

// ─── Certificate Routes ──────────────────────────────────────────────────────

// Lay danh sach chung chi
app.get('/api/certificates', requireAuth, getMyCertificates);
// Xem chi tiet chung chi theo so chung chi
app.get('/api/certificates/:certificateNumber', requireAuth, getCertificateByNumber);

// ─── Internal Routes (khong qua Gateway) ────────────────────────────────────

// Middleware guard: chi cho phep internal service goi
function internalOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-internal-call'] !== 'true') {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  next();
}

// Community-service goi de kiem tra enrollment (x-internal-call header)
app.get('/internal/enrollment/check', internalOnly, internalCheckEnrollment);

// Course-service goi de kiem tra hoan thanh khoa hoc (x-internal-call header)
app.get('/internal/courses/:courseId/completion', internalOnly, internalGetCourseCompletion);

// ─── DLQ Admin Routes ────────────────────────────────────────────────────────

// Admin DLQ management
app.get('/api/admin/dlq/stats', ...requireRole('admin'), getFailedEventStats);
app.get('/api/admin/dlq', ...requireRole('admin'), listFailedEvents);
app.get('/api/admin/dlq/:id', ...requireRole('admin'), getFailedEvent);
app.post('/api/admin/dlq/:id/retry', ...requireRole('admin'), retryFailedEvent);
app.patch('/api/admin/dlq/:id/resolve', ...requireRole('admin'), resolveFailedEvent);

// ─── 404 Handler ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, code: 404, message: 'Route not found', data: null });
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, '[learning-service] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Start ───────────────────────────────────────────────────────────────────

async function start() {
  try {
    await prisma.$connect();
    logger.info('[learning-service] Database connected');

    // Kafka consumers bat dau sau khi DB ready
    if (process.env.KAFKA_BROKER) {
      startKafkaConsumers().catch((err) => {
        logger.error({ err }, '[learning-service] Failed to start Kafka consumers');
      });
    } else {
      logger.warn('[learning-service] KAFKA_BROKER not set — skipping Kafka consumers');
    }

    app.listen(PORT, () => {
      logger.info({ port: PORT }, '[learning-service] Server started');
    });
  } catch (err) {
    logger.error({ err }, '[learning-service] Failed to start');
    process.exit(1);
  }
}

start();
