import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import { withRetry } from '@lms/db-prisma';
import { validateNotificationServiceEnv } from '@lms/env-validator';
import { createRequireAdmin, createRequireInternal, type ApiResponse } from '@lms/types';
import {
  createConsumer,
  createProducer,
  consumeWithRetry,
  ENROLLMENT_CREATED_RETRY,
  PAYMENT_ORDER_COMPLETED_RETRY,
  TOPICS,
  type EnrollmentCreatedEvent,
  type PaymentOrderCompletedEvent,
  type KafkaEventEnvelope,
  type KafkaTopic,
} from '@lms/kafka-client';
import prisma from './lib/prisma.js';
import { requireAuth } from './middleware/require-auth.js';
import {
  listMyNotifications,
  listAdminNotifications,
  markAllAsRead,
  markAsRead,
  createInternalNotification,
} from './controllers/notification.controller.js';
import { sendEmail, getPaymentSuccessTemplate, getEnrollmentCreatedTemplate } from './lib/mailer.js';
import { getUserData } from './lib/user.js';

// Validate env khi khoi dong
validateNotificationServiceEnv();

const app = express();
const PORT = process.env.PORT || 3005;
const requireAdmin = createRequireAdmin();
const requireInternal = createRequireInternal({
  internalSecret: process.env.INTERNAL_SERVICE_SECRET || '',
});
const demoEmailAttempts = new Map<string, number>();

async function deliverEmail(params: {
  notificationId: string;
  eventId: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const configuredFailures = Number(process.env.DEMO_NOTIFICATION_FAIL_ATTEMPTS || 0);
  const attempt = (demoEmailAttempts.get(params.eventId) || 0) + 1;
  demoEmailAttempts.set(params.eventId, attempt);

  try {
    if (attempt <= configuredFailures) {
      logger.warn({ eventId: params.eventId, attempt }, 'Demo transient email failure');
      throw new Error(`Demo transient email failure attempt ${attempt}`);
    }
    await sendEmail(params.to, params.subject, params.html);
    await withRetry(() =>
      prisma.notification.update({
        where: { id: params.notificationId },
        data: { status: 'SENT', sentAt: new Date() },
      }),
    );
  } catch (err) {
    await withRetry(() =>
      prisma.notification.update({
        where: { id: params.notificationId },
        data: { status: 'FAILED' },
      }),
    );
    throw err;
  }
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());

app.get(['/health', '/livez', '/readyz'], (_req: Request, res: Response) => {
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
app.get('/api/admin/history', requireAdmin, listAdminNotifications);
app.post('/internal/notifications', requireInternal, createInternalNotification);

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

  const paymentHandler = async (event: KafkaEventEnvelope<PaymentOrderCompletedEvent>) => {
    const { order_id, user_id, course_id, amount, currency } = event.data;

    // Event id la idempotency key de Kafka replay khong tao duplicate notification.
    const notification = await withRetry(() =>
      prisma.notification.upsert({
        where: { eventId: event.event_id },
        create: {
          userId: user_id,
          type: 'PAYMENT_SUCCESS',
          channel: 'EMAIL',
          status: 'PENDING',
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
        },
        update: {},
      }),
    );

    if (notification.status === 'SENT') return;
    const userData = await getUserData(user_id);
    if (!userData) throw new Error(`User ${user_id} unavailable for payment email`);
    const html = getPaymentSuccessTemplate(userData.name, amount, currency, order_id);
    await deliverEmail({
      notificationId: notification.id,
      eventId: event.event_id,
      to: userData.email,
      subject: 'Thanh toan thanh cong don hang tren LMS',
      html,
    });
    logger.info({ orderId: order_id, userId: user_id }, 'Email Payment Success sent.');
  };

  const paymentTopics: KafkaTopic[] = [
    TOPICS.PAYMENT_ORDER_COMPLETED,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_5S,
    TOPICS.PAYMENT_ORDER_COMPLETED_RETRY_1M,
  ];

  await Promise.all(
    paymentTopics.map(async (topic) => {
      const consumer = await createConsumer(`notification-service.payment.${topic}`);
      await consumeWithRetry<PaymentOrderCompletedEvent>(consumer, producer, {
        topic,
        groupId: `notification-service.payment.${topic}`,
        retry: PAYMENT_ORDER_COMPLETED_RETRY,
        handler: paymentHandler,
        onError: (err) => logger.error({ err, topic }, 'Payment notification consumer failed'),
      });
      logger.info({ topic }, 'Subscribed to payment.order.completed flow');
    }),
  );

  const enrollmentHandler = async (event: KafkaEventEnvelope<EnrollmentCreatedEvent>) => {
    const { user_id, course_id, order_id } = event.data;

    const notification = await withRetry(() =>
      prisma.notification.upsert({
        where: { eventId: event.event_id },
        create: {
          userId: user_id,
          type: 'ENROLLMENT_CREATED',
          channel: 'EMAIL',
          status: 'PENDING',
          title: 'Ghi danh thanh cong',
          body: 'Chuc mung! Ban da duoc ghi danh vao khoa hoc. Vao trang Hoc cua toi de bat dau.',
          metadata: {
            courseId: course_id,
            orderId: order_id ?? null,
          },
          eventId: event.event_id,
          traceId: event.trace_id,
        },
        update: {},
      }),
    );

    if (notification.status === 'SENT') return;
    const userData = await getUserData(user_id);
    if (!userData) throw new Error(`User ${user_id} unavailable for enrollment email`);
    const html = getEnrollmentCreatedTemplate(userData.name);
    await deliverEmail({
      notificationId: notification.id,
      eventId: event.event_id,
      to: userData.email,
      subject: 'Ghi danh thanh cong khoa hoc tren LMS',
      html,
    });
    logger.info({ courseId: course_id, userId: user_id }, 'Email Enrollment Created sent.');
  };

  const enrollmentTopics: KafkaTopic[] = [
    TOPICS.ENROLLMENT_CREATED,
    TOPICS.ENROLLMENT_CREATED_RETRY_5S,
    TOPICS.ENROLLMENT_CREATED_RETRY_1M,
  ];

  await Promise.all(
    enrollmentTopics.map(async (topic) => {
      const consumer = await createConsumer(`notification-service.enrollment.${topic}`);
      await consumeWithRetry<EnrollmentCreatedEvent>(consumer, producer, {
        topic,
        groupId: `notification-service.enrollment.${topic}`,
        retry: ENROLLMENT_CREATED_RETRY,
        handler: enrollmentHandler,
        onError: (err) => logger.error({ err, topic }, 'Enrollment notification consumer failed'),
      });
      logger.info({ topic }, 'Subscribed to learning.enrollment.created flow');
    }),
  );
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
