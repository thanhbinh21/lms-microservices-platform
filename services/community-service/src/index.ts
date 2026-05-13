import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import prisma from './lib/prisma.js';

// Validate bien moi truong
const requiredEnvVars = ['DATABASE_URL', 'LEARNING_SERVICE_URL', 'INTERNAL_SERVICE_SECRET'] as const;
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    logger.error({ key }, '[community-service] Missing required env var');
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT || '3007', 10);
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// Lay userId/userRole tu Kong Gateway headers
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  const userRole = req.headers['x-user-role'] as string | undefined;
  if (userId) {
    res.locals.userId = userId;
    res.locals.userRole = (userRole || '').toLowerCase();
  }
  next();
});

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'community-service', port: PORT });
});

// ─── Community Routes ────────────────────────────────────────────────────────

// Lazy import de tranh khoi tao Prisma truoc khi DB connect
const { communityRouter } = await import('./routes/community.routes.js');
const { qaRouter } = await import('./routes/qa.routes.js');

app.use('/api/community', communityRouter);
app.use('/api/qa', qaRouter);

// ─── 404 Handler ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, code: 404, message: 'Route not found', data: null });
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, '[community-service] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Start ───────────────────────────────────────────────────────────────────

async function start() {
  try {
    await prisma.$connect();
    logger.info('[community-service] Database connected');

    app.listen(PORT, () => {
      logger.info({ port: PORT }, '[community-service] Server started');
    });
  } catch (err) {
    logger.error({ err }, '[community-service] Failed to start');
    process.exit(1);
  }
}

start();
