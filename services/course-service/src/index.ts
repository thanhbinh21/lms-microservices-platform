import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import { validateCourseServiceEnv } from '@lms/env-validator';
import type { ApiResponse } from '@lms/types';
import {
  listCourses,
  getCourseBySlug,
  createCourse,
  updateCourse,
  publishCourse,
  deleteCourse,
  getInstructorCourses,
  getInstructorCourseById,
  getCourseCurriculum,
  getCoursePublishGuard,
  listCourseReviews,
  getCourseReviewStats,
  getMyCourseReview,
  upsertCourseReview,
} from './controllers/course.controller';
import {
  listCommunityGroups,
  listCommunityPosts,
  createCommunityPost,
  replyCommunityPost,
  reactCommunityPost,
  joinCommunityGroup,
  createPublicCommunityGroup,
} from './controllers/community.controller';
import {
  createChapter,
  updateChapter,
  deleteChapter,
  reorderChapters,
} from './controllers/chapter.controller';
import {
  createLesson,
  updateLesson,
  deleteLesson,
  getLessonPlayback,
} from './controllers/lesson.controller';
import { listCategories, createCategory } from './controllers/category.controller';
import { enrollCourse, getMyEnrollments } from './controllers/enrollment.controller';
import { getCourseProgress, updateLessonProgress } from './controllers/progress.controller';
import { getLearnData, getEnrollmentStatus, completeLesson, getMyCourses, getMyCertificates } from './controllers/learning.controller';
import { getCourseByIdInternal } from './controllers/internal.controller';
import { requireAuth, requireRole } from './middleware/require-auth';
import adminRouter from './routes/admin.routes';
import prisma from './lib/prisma';
import { disconnectProducer } from './lib/kafka-producer';
import { startKafkaConsumers } from './lib/kafka-consumer';
import { initCache, closeCache } from '@lms/cache';

// Validate bien moi truong khi khoi dong
validateCourseServiceEnv();

const app = express();
const PORT = process.env.PORT || 3002;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Ghi log request
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, traceId: req.headers['x-trace-id'] }, 'Incoming request');
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  const response: ApiResponse<{ service: string }> = {
    success: true,
    code: 200,
    message: 'OK',
    data: { service: 'course-service' },
    trace_id: '',
  };
  res.status(200).json(response);
});

// ─── Internal service-to-service routes (KHONG expose qua Kong) ──────────────
// Payment-service goi /internal/courses/:id de verify price.
app.get('/internal/courses/:id', getCourseByIdInternal);

// ─── Student Learning Routes (prefix /api/student/ to avoid /:slug conflict) ─
app.post('/api/student/courses/:courseId/enroll-free', requireAuth, enrollCourse);
app.get('/api/student/courses/:courseId/learn-data', requireAuth, getLearnData);
app.get('/api/student/courses/:courseId/progress', requireAuth, getCourseProgress);
app.get('/api/student/courses/:courseId/enrollment-status', requireAuth, getEnrollmentStatus);
app.put('/api/student/lessons/:lessonId/progress', requireAuth, updateLessonProgress);
app.post('/api/student/lessons/:lessonId/complete', requireAuth, completeLesson);
app.get('/api/student/my-courses', requireAuth, getMyCourses);
app.get('/api/student/certificates', requireAuth, getMyCertificates);

// ─── Community Routes ───────────────────────────────────────────────────────
app.get('/api/community/groups', requireAuth, listCommunityGroups);
app.post('/api/community/groups/:groupId/join', requireAuth, joinCommunityGroup);
app.get('/api/community/groups/:groupId/posts', requireAuth, listCommunityPosts);
app.post('/api/community/groups/:groupId/posts', requireAuth, createCommunityPost);
app.post('/api/community/groups/:groupId/posts/:postId/reply', requireAuth, replyCommunityPost);
app.post('/api/community/groups/:groupId/posts/:postId/react', requireAuth, reactCommunityPost);

// ─── Public Routes ────────────────────────────────────────────────────────────
app.get('/api/categories', listCategories);
app.get('/api/courses', listCourses);
app.get('/api/courses/:courseId/reviews', listCourseReviews);
app.get('/api/courses/:courseId/reviews/stats', getCourseReviewStats);
app.get('/api/courses/:courseId/reviews/me', requireAuth, getMyCourseReview);
app.post('/api/courses/:courseId/reviews', requireAuth, upsertCourseReview);
app.get('/api/courses/:slug', getCourseBySlug);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.post('/api/admin/categories', ...requireRole('admin'), createCategory);
app.post('/api/admin/community/groups', ...requireRole('admin'), createPublicCommunityGroup);
app.use('/api/admin', ...requireRole('admin'), adminRouter);

// ─── Instructor Routes (Kong injects x-user-id, x-user-role) ─────────────────
// requireRole middleware: validates header exists + role check, sets res.locals.userId
app.get('/api/instructor/courses', requireAuth, getInstructorCourses);
app.get('/api/instructor/courses/:id', requireAuth, getInstructorCourseById);
app.get('/api/instructor/courses/:id/publish-guard', ...requireRole('instructor', 'admin'), getCoursePublishGuard);
app.get('/api/courses/:id/curriculum', ...requireRole('instructor', 'admin'), getCourseCurriculum);
app.post('/api/courses', ...requireRole('instructor', 'admin'), createCourse);
app.put('/api/courses/:id', ...requireRole('instructor', 'admin'), updateCourse);
app.post('/api/courses/:id/publish', ...requireRole('instructor', 'admin'), publishCourse);
app.delete('/api/courses/:id', ...requireRole('instructor', 'admin'), deleteCourse);

// Chapter routes
app.post('/api/courses/:courseId/chapters', ...requireRole('instructor', 'admin'), createChapter);
app.put('/api/courses/:courseId/chapters/:chapterId', ...requireRole('instructor', 'admin'), updateChapter);
app.delete('/api/courses/:courseId/chapters/:chapterId', ...requireRole('instructor', 'admin'), deleteChapter);
app.put('/api/courses/:courseId/chapters/reorder', ...requireRole('instructor', 'admin'), reorderChapters);

// Route bai hoc
app.post('/api/courses/:courseId/chapters/:chapterId/lessons', ...requireRole('instructor', 'admin'), createLesson);
app.put('/api/courses/:courseId/chapters/:chapterId/lessons/:lessonId', ...requireRole('instructor', 'admin'), updateLesson);
app.delete('/api/courses/:courseId/chapters/:chapterId/lessons/:lessonId', ...requireRole('instructor', 'admin'), deleteLesson);
app.get('/api/lessons/:lessonId/playback', getLessonPlayback);

// ─── Student Learning Routes (Enrollment & Progress) ──────────────────────────
app.post('/api/enrollments', requireAuth, enrollCourse);
app.get('/api/enrollments/my', requireAuth, getMyEnrollments);
// app.get('/api/courses/:courseId/progress', requireAuth, getCourseProgress); // Removed duplicate
// app.put('/api/lessons/:lessonId/progress', requireAuth, updateLessonProgress); // Removed duplicate

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  const response: ApiResponse<null> = {
    success: false,
    code: 404,
    message: `Route not found: ${req.method} ${req.url}`,
    data: null,
    trace_id: req.headers['x-trace-id'] as string || '',
  };
  res.status(404).json(response);
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  const response: ApiResponse<null> = {
    success: false,
    code: 500,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    data: null,
    trace_id: req.headers['x-trace-id'] as string || '',
  };
  res.status(500).json(response);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`[COURSE-SERVICE] Da khoi dong tren port ${PORT}`);
  logger.info(`Moi truong: ${process.env.NODE_ENV}`);
});

// Khoi dong Redis cache (Upstash) — non-blocking
if (process.env.CACHE_REDIS_URL) {
  initCache(process.env.CACHE_REDIS_URL).catch((err) => {
    logger.warn({ err }, '[COURSE-SERVICE] Cache Redis init failed — se chay khong co cache');
  });
} else {
  logger.warn('CACHE_REDIS_URL chua set — bo qua cache layer');
}

// Khoi dong Kafka consumer (Phase 16: payment.order.completed -> enrollment).
// Khong block khoi dong HTTP server; neu Kafka chua san, log warning va thu lai.
if (process.env.KAFKA_BROKER) {
  startKafkaConsumers().catch((err) => {
    logger.error({ err }, '[COURSE-SERVICE] Kafka consumer start failed — se thu lai sau 10s');
    setTimeout(() => {
      startKafkaConsumers().catch((retryErr) =>
        logger.error({ err: retryErr }, '[COURSE-SERVICE] Kafka consumer retry failed'),
      );
    }, 10_000);
  });
} else {
  logger.warn('KAFKA_BROKER chua set — bo qua consumer (flow mua khoa hoc se khong tao enrollment)');
}

// Tat server an toan
const shutdown = async (signal: string) => {
  logger.info(`${signal} - dang tat server`);
  const forceExitTimer = setTimeout(() => process.exit(1), 10_000);

  server.close(async () => {
    try {
      await disconnectProducer();
      await prisma.$disconnect();
      await closeCache();
      clearTimeout(forceExitTimer);
      logger.info('Server closed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Loi khi dong Prisma luc shutdown');
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('uncaughtException', (err) => { logger.fatal(err, 'Uncaught exception'); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.fatal(err, 'Unhandled rejection'); process.exit(1); });
