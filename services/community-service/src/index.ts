import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  ENROLLMENT_CREATED_RETRY,
  EnrollmentCreatedSchema,
  TOPICS,
  type EnrollmentCreatedEvent,
  type KafkaTopic,
  validateKafkaEvent,
} from '@lms/kafka-client';
import { logger } from '@lms/logger';
import prisma from './lib/prisma.js';

type ConnectedProducer = Awaited<ReturnType<typeof createProducer>>;
type ConnectedConsumer = Awaited<ReturnType<typeof createConsumer>>;

const PORT = parseInt(process.env.PORT || '3007', 10);
const app = express();

let producer: ConnectedProducer | null = null;
const consumers: ConnectedConsumer[] = [];
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

app.get('/health', (_req, res) => {
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

async function startEnrollmentPermissionConsumers(): Promise<void> {
  producer = await createProducer();

  const topics: KafkaTopic[] = [
    TOPICS.ENROLLMENT_CREATED,
    TOPICS.ENROLLMENT_CREATED_RETRY_5S,
    TOPICS.ENROLLMENT_CREATED_RETRY_1M,
  ];

  await Promise.all(topics.map(async (topic) => {
    const groupId = `community-service.enrollment-permission.${topic}`;
    const consumer = await createConsumer(groupId);
    consumers.push(consumer);

    await consumeWithRetry<EnrollmentCreatedEvent>(consumer, producer as ConnectedProducer, {
      topic,
      groupId,
      retry: ENROLLMENT_CREATED_RETRY,
      handler: async (event) => {
        const validated = validateKafkaEvent(
          EnrollmentCreatedSchema,
          event.data,
          'learning.enrollment.created',
          logger,
        );
        if (!validated) throw new Error('Invalid learning.enrollment.created payload');

        await prisma.courseEnrollmentPermission.upsert({
          where: {
            userId_courseId: {
              userId: validated.user_id,
              courseId: validated.course_id,
            },
          },
          create: {
            userId: validated.user_id,
            courseId: validated.course_id,
            orderId: validated.order_id,
            enrolledAt: new Date(validated.enrolled_at),
            source: 'kafka',
          },
          update: {
            orderId: validated.order_id,
            enrolledAt: new Date(validated.enrolled_at),
            source: 'kafka',
          },
        });
      },
      onError: (err) => {
        logger.error({ err, topic }, '[community-service] Enrollment permission consumer failed');
      },
    });

    logger.info({ topic, groupId }, '[community-service] Enrollment permission consumer running');
  }));
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, '[community-service] Shutting down');

  if (server) {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
  }

  await Promise.all(consumers.map((consumer) => consumer.disconnect().catch(() => undefined)));

  if (producer) {
    await producer.disconnect().catch(() => undefined);
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

    if (process.env.KAFKA_BROKER) {
      await startEnrollmentPermissionConsumers();
    } else {
      logger.warn('[community-service] KAFKA_BROKER missing, skip enrollment permission consumers');
    }
  } catch (err) {
    logger.error({ err }, '[community-service] Failed to start');
    process.exit(1);
  }
}

void start();
