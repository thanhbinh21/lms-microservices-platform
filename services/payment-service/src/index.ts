import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@lms/logger';
import { validatePaymentServiceEnv } from '@lms/env-validator';
import type { ApiResponse } from '@lms/types';
import { requireAuth } from './middleware/require-auth';
import { createOrder, getOrder, getMyOrders } from './controllers/order.controller';
import { handleVNPayReturn, handleVNPayIPN } from './controllers/vnpay.controller';
import prisma from './lib/prisma';
import { disconnectProducer } from './lib/kafka-producer';

// Validate env ngay luc khoi dong.
validatePaymentServiceEnv();

const app = express();
const PORT = process.env.PORT || 3003;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

// Ghi log request ngan gon
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(
    { method: req.method, url: req.url, traceId: req.headers['x-trace-id'] },
    '[PAYMENT] Incoming',
  );
  next();
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  const response: ApiResponse<{ service: string }> = {
    success: true,
    code: 200,
    message: 'OK',
    data: { service: 'payment-service' },
    trace_id: '',
  };
  res.status(200).json(response);
});

// ─── VNPay public callbacks (KHONG requireAuth) ───────────────────────────────
// Return URL — user redirect ve sau khi thanh toan.
app.get('/api/vnpay-return', handleVNPayReturn);
// IPN — VNPay goi server-to-server. Cho phep ca GET (chuan) va POST (defensive).
app.get('/api/vnpay-ipn', handleVNPayIPN);
app.post('/api/vnpay-ipn', handleVNPayIPN);

// ─── Authenticated endpoints ──────────────────────────────────────────────────
app.post('/api/orders', requireAuth, createOrder);
app.get('/api/orders/my', requireAuth, getMyOrders);
app.get('/api/orders/:id', requireAuth, getOrder);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  const response: ApiResponse<null> = {
    success: false,
    code: 404,
    message: `Route not found: ${req.method} ${req.url}`,
    data: null,
    trace_id: (req.headers['x-trace-id'] as string) || '',
  };
  res.status(404).json(response);
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  const response: ApiResponse<null> = {
    success: false,
    code: 500,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    data: null,
    trace_id: (req.headers['x-trace-id'] as string) || '',
  };
  res.status(500).json(response);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`[PAYMENT-SERVICE] Listening on port ${PORT}`);
  logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
});

// Tat server an toan
const shutdown = async (signal: string) => {
  logger.info(`${signal} - shutting down payment-service`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);

  server.close(async () => {
    try {
      await disconnectProducer();
      await prisma.$disconnect();
      clearTimeout(forceExit);
      logger.info('payment-service closed');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      clearTimeout(forceExit);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.fatal(err, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'unhandledRejection');
  process.exit(1);
});
