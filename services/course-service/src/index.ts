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
  deleteCourse,
  getInstructorCourses,
} from './controllers/course.controller';
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
} from './controllers/lesson.controller';
import { requireAuth, requireRole } from './middleware/require-auth';

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

// ─── Public Routes ────────────────────────────────────────────────────────────
app.get('/api/courses', listCourses);
app.get('/api/courses/:slug', getCourseBySlug);

// ─── Instructor Routes (Kong injects x-user-id, x-user-role) ─────────────────
// requireRole middleware: validates header exists + role check, sets res.locals.userId
app.get('/api/instructor/courses', requireAuth, getInstructorCourses);
app.post('/api/courses', ...requireRole('instructor', 'admin'), createCourse);
app.put('/api/courses/:id', ...requireRole('instructor', 'admin'), updateCourse);
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

// Tat server an toan
const shutdown = (signal: string) => {
  logger.info(`${signal} - dang tat server`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.fatal(err, 'Uncaught exception'); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.fatal(err, 'Unhandled rejection'); process.exit(1); });
