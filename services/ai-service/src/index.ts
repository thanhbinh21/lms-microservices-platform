import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './lib/logger.js';
import { validateAiServiceEnv } from './lib/env.js';
import { initRedis, closeRedis } from './lib/cache.js';
import { requireAuth, requireInternal } from './middleware/require-auth.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  getMessages,
  sendMessage,
  getAiContextStatus,
} from './controllers/chat.controller.js';
import {
  generateQuiz,
  submitQuiz,
  getQuizHistory,
  getLessonQuiz,
  getCourseQuizStatus,
  checkQuizPassedInternal,
} from './controllers/quiz.controller.js';
import prisma from './lib/prisma.js';

validateAiServiceEnv();

const app = express();
const PORT = process.env.PORT || 3008;

// ─── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, traceId: req.headers['x-trace-id'] }, 'Incoming request');
  next();
});

// ─── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, code: 200, message: 'OK', data: { service: 'ai-service' }, trace_id: '' });
});

// ─── Internal Routes (called by other services) ─────────────────────────────────
app.get('/internal/quiz/check', requireInternal, checkQuizPassedInternal);

// ─── Chat Routes ────────────────────────────────────────────────────────────────
// Note: Kong Gateway strips /ai prefix, so these are /api/* not /ai/api/*
app.post('/api/chat/conversations', requireAuth, createConversation);
app.get('/api/chat/conversations', requireAuth, listConversations);
app.get('/api/chat/conversations/:id', requireAuth, getConversation);
app.delete('/api/chat/conversations/:id', requireAuth, deleteConversation);
app.get('/api/chat/conversations/:id/messages', requireAuth, getMessages);
app.post('/api/chat/conversations/:id/messages', requireAuth, sendMessage);
app.get('/api/chat/ai-context/:lessonId', requireAuth, getAiContextStatus);

// ─── Quiz Routes ────────────────────────────────────────────────────────────────
app.post('/api/quiz/generate', requireAuth, generateQuiz);
app.post('/api/quiz/submit', requireAuth, submitQuiz);
app.get('/api/quiz/history', requireAuth, getQuizHistory);
app.get('/api/quiz/lesson/:lessonId', requireAuth, getLessonQuiz);
app.get('/api/quiz/course/:courseId/status', requireAuth, getCourseQuizStatus);

// ─── 404 ────────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    code: 404,
    message: `Route not found: ${req.method} ${req.url}`,
    data: null,
    trace_id: req.headers['x-trace-id'] || '',
  });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  res.status(500).json({
    success: false,
    code: 500,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    data: null,
    trace_id: req.headers['x-trace-id'] || '',
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`[AI-SERVICE] Da khoi dong tren port ${PORT}`);
  logger.info(`Moi truong: ${process.env.NODE_ENV}`);
});

// Khoi dong Redis cache
if (process.env.CACHE_REDIS_URL) {
  void initRedis().catch((err) => {
    logger.warn({ err }, '[AI-SERVICE] Cache Redis init failed — using memory cache');
  });
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info(`${signal} — dang tat ai-service`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      await closeRedis();
      clearTimeout(forceExit);
      logger.info('AI service closed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Loi khi shutdown');
      clearTimeout(forceExit);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('uncaughtException', (err) => { logger.fatal(err, 'Uncaught exception'); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.fatal(err, 'Unhandled rejection'); process.exit(1); });
