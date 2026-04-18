import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import { validateNotificationServiceEnv } from '@lms/env-validator';
import type { ApiResponse } from '@lms/types';
import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  TOPICS,
  type EnrollmentCreatedEvent,
  type PaymentOrderCompletedEvent,
  type KafkaEventEnvelope,
} from '@lms/kafka-client';
import prisma from './lib/prisma';
import { requireAuth } from './middleware/require-auth';
import {
  listMyNotifications,
  markAllAsRead,
  markAsRead,
} from './controllers/notification.controller';

// Validate env khi khoi dong
validateNotificationServiceEnv();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  const response: ApiResponse<{ service: string }> = {
    success: true,
    code: 200,
    message: 'OK',
    data: { service: 'notification-service' },
    trace_id: '',
  };
  res.status(200).json(response);
});

// ─── Routes (tat ca can x-user-id tu Kong Gateway) ──────────────────────────
app.get('/api/my', requireAuth, listMyNotifications);
app.post('/api/read-all', requireAuth, markAllAsRead);
app.post('/api/:id/read', requireAuth, markAsRead);

const server = app.listen(PORT, () => {
  logger.info(`[NOTIFICATION-SERVICE] Listening on port ${PORT}`);
});

// ─── Kafka consumers ─────────────────────────────────────────────────────────
//
// Phase 11 stub: luu notification vao DB + log "mock email sent".
// Phase 11 full: them Nodemailer/Resend, render template, retry neu email fail.
//
// Idempotency: dung event.event_id (Kafka envelope) lam unique key
// tren Notification.eventId — neu Kafka replay, chi tao 1 notification duy nhat.

async function startConsumers() {
  const producer = await createProducer();

  // 1) payment.order.completed -> notification "Cam on da mua khoa hoc"
  const paymentConsumer = await createConsumer('notification-service.payment');
  await consumeWithRetry<PaymentOrderCompletedEvent>(paymentConsumer, producer, {
    topic: TOPICS.PAYMENT_ORDER_COMPLETED,
    groupId: 'notification-service.payment',
    handler: async (event: KafkaEventEnvelope<PaymentOrderCompletedEvent>) => {
      const { order_id, user_id, course_id, amount, currency } = event.data;

      // Idempotent upsert — neu event_id da ton tai thi bo qua.
      await prisma.notification.upsert({
        where: { eventId: event.event_id },
        create: {
          userId: user_id,
          type: 'PAYMENT_SUCCESS',
          channel: 'IN_APP',
          status: 'MOCKED',
          title: 'Thanh toan thanh cong',
          body: `Ban da thanh toan ${amount.toLocaleString('vi-VN')} ${currency} cho don hang ${order_id}. Cam on da mua khoa hoc!`,
          metadata: {
            orderId: order_id,
            courseId: course_id,
            amount,
            currency,
            vnpTxnRef: event.data.vnp_txn_ref,
          },
          eventId: event.event_id,
          traceId: event.trace_id,
          sentAt: new Date(),
        },
        update: {}, // Khong update neu da ton tai — giu nguyen de idempotent.
      });

      logger.info(
        {
          orderId: order_id,
          userId: user_id,
          courseId: course_id,
          amount,
          currency,
          eventId: event.event_id,
        },
        '[MOCK EMAIL] Cam on ban da mua khoa hoc — notification luu DB thanh cong.',
      );
    },
  });
  logger.info('Subscribed to payment.order.completed');

  // 2) learning.enrollment.created -> notification "Ban da duoc ghi danh"
  const enrollConsumer = await createConsumer('notification-service.enrollment');
  await consumeWithRetry<EnrollmentCreatedEvent>(enrollConsumer, producer, {
    topic: TOPICS.ENROLLMENT_CREATED,
    groupId: 'notification-service.enrollment',
    handler: async (event: KafkaEventEnvelope<EnrollmentCreatedEvent>) => {
      const { user_id, course_id, order_id } = event.data;

      await prisma.notification.upsert({
        where: { eventId: event.event_id },
        create: {
          userId: user_id,
          type: 'ENROLLMENT_CREATED',
          channel: 'IN_APP',
          status: 'MOCKED',
          title: 'Ghi danh thanh cong',
          body: 'Chuc mung! Ban da duoc ghi danh vao khoa hoc. Vao trang Hoc cua toi de bat dau.',
          metadata: {
            courseId: course_id,
            orderId: order_id ?? null,
          },
          eventId: event.event_id,
          traceId: event.trace_id,
          sentAt: new Date(),
        },
        update: {},
      });

      logger.info(
        {
          userId: user_id,
          courseId: course_id,
          orderId: order_id,
          eventId: event.event_id,
        },
        '[MOCK EMAIL] Chuc mung! Ban da duoc ghi danh vao khoa hoc.',
      );
    },
  });
  logger.info('Subscribed to learning.enrollment.created');
}

if (process.env.KAFKA_BROKER) {
  startConsumers().catch((err) => {
    logger.error({ err }, '[NOTIFICATION-SERVICE] Consumer start failed — retry in 10s');
    setTimeout(
      () => startConsumers().catch((e) => logger.error({ err: e }, 'retry failed')),
      10_000,
    );
  });
}

const shutdown = async (signal: string) => {
  logger.info(`${signal} - shutting down notification-service`);
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.fatal(err, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'unhandledRejection');
  process.exit(1);
});
