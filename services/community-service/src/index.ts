import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import prisma from './lib/prisma.js';

const PORT = parseInt(process.env.PORT || '3007', 10);
const app = express();

let server: ReturnType<typeof app.listen> | null = null;

// Validate bien moi truong
const requiredEnvVars = ['DATABASE_URL', 'LEARNING_SERVICE_URL', 'INTERNAL_SERVICE_SECRET'] as const;
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    logger.error({ key }, '[community-service] Missing required env var');
    process.exit(1);
  }
}

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

app.get(['/health', '/livez', '/readyz'], (_req, res) => {
  res.json({ status: 'ok', service: 'community-service', port: PORT });
});

// Lazy import de tranh khoi tao Prisma truoc khi DB connect
const { communityRouter } = await import('./routes/community.routes.js');
const { qaRouter } = await import('./routes/qa.routes.js');

app.use('/api/community', communityRouter);
app.use('/api/qa', qaRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, code: 404, message: 'Route not found', data: null });
});

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, '[community-service] Shutting down');

  if (server) {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
  }

  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('[community-service] Database connected');

    server = app.listen(PORT, () => {
      logger.info({ port: PORT }, '[community-service] Server started');
    });
  } catch (err) {
    logger.error({ err }, '[community-service] Failed to start');
    process.exit(1);
  }
}

void start();
