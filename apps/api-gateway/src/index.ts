import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth';
import { traceMiddleware } from './middleware/trace';
import { errorHandler } from './middleware/error';
import logger from '@lms/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Basic Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { success: false, code: 429, message: 'Too many requests', data: null },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ success: true, code: 200, message: 'API Gateway is healthy', data: null });
});

// Public Routes (No Auth Required)
const publicRoutes = ['/auth/login', '/auth/register'];

// Auth Service Proxy
app.use(
  '/auth',
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: { '^/auth': '' },
    onProxyReq: (proxyReq, req) => {
      if ('trace_id' in req) {
        proxyReq.setHeader('x-trace-id', (req as any).trace_id);
      }
    },
  })
);

// Protected Routes - Require JWT
app.use('/course', authMiddleware);
app.use(
  '/course',
  createProxyMiddleware({
    target: process.env.COURSE_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/course': '' },
    onProxyReq: (proxyReq, req) => {
      if ('user' in req) {
        const user = (req as any).user;
        proxyReq.setHeader('x-user-id', user.userId);
        proxyReq.setHeader('x-user-role', user.role);
      }
      if ('trace_id' in req) {
        proxyReq.setHeader('x-trace-id', (req as any).trace_id);
      }
    },
  })
);

app.use('/payment', authMiddleware);
app.use(
  '/payment',
  createProxyMiddleware({
    target: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: { '^/payment': '' },
    onProxyReq: (proxyReq, req) => {
      if ('user' in req) {
        const user = (req as any).user;
        proxyReq.setHeader('x-user-id', user.userId);
        proxyReq.setHeader('x-user-role', user.role);
      }
      if ('trace_id' in req) {
        proxyReq.setHeader('x-trace-id', (req as any).trace_id);
      }
    },
  })
);

app.use('/media', authMiddleware);
app.use(
  '/media',
  createProxyMiddleware({
    target: process.env.MEDIA_SERVICE_URL || 'http://localhost:3004',
    changeOrigin: true,
    pathRewrite: { '^/media': '' },
    onProxyReq: (proxyReq, req) => {
      if ('user' in req) {
        const user = (req as any).user;
        proxyReq.setHeader('x-user-id', user.userId);
        proxyReq.setHeader('x-user-role', user.role);
      }
      if ('trace_id' in req) {
        proxyReq.setHeader('x-trace-id', (req as any).trace_id);
      }
    },
  })
);

app.use('/notification', authMiddleware);
app.use(
  '/notification',
  createProxyMiddleware({
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
    changeOrigin: true,
    pathRewrite: { '^/notification': '' },
    onProxyReq: (proxyReq, req) => {
      if ('user' in req) {
        const user = (req as any).user;
        proxyReq.setHeader('x-user-id', user.userId);
        proxyReq.setHeader('x-user-role', user.role);
      }
      if ('trace_id' in req) {
        proxyReq.setHeader('x-trace-id', (req as any).trace_id);
      }
    },
  })
);

// Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
});
