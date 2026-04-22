import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { logger } from '@lms/logger';
import { validateMediaServiceEnv } from '@lms/env-validator';
import type { ApiResponse } from '@lms/types';
import { requireAuth, requireRole } from './middleware/require-auth';
import { requestPresignedUpload, confirmUpload, registerExternalMedia } from './controllers/upload.controller';
import { getMediaAsset, getMediaByLesson, getMediaByCourse, deleteMediaAsset } from './controllers/media.controller';
import { getActiveStorageProvider, shouldEnableLocalUploadRoutes } from './storage';
import { LocalStorageProvider } from './storage/local.storage';
import prisma from './lib/prisma';
import { initCache, closeCache } from '@lms/cache';

// Validate bien moi truong khi khoi dong
validateMediaServiceEnv();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware bao mat
app.use(
  helmet({
    // Cho phep web-client (khac origin khi dev) render anh/video tra ve tu media-service.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Ghi log request
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, traceId: req.headers['x-trace-id'] }, 'Incoming request');
  next();
});

// Kiem tra suc khoe
app.get('/health', (_req: Request, res: Response) => {
  const activeStorage = getActiveStorageProvider();
  const response: ApiResponse<{ service: string; storage: string }> = {
    success: true, code: 200, message: 'OK',
    data: {
      service: 'media-service',
      storage: activeStorage,
    },
    trace_id: '',
  };
  res.status(200).json(response);
});

// Route upload (chi giang vien/admin)
app.post('/api/upload/presigned', ...requireRole('instructor', 'admin'), requestPresignedUpload);
app.post('/api/upload/complete', ...requireRole('instructor', 'admin'), confirmUpload);
app.post('/api/upload/external', ...requireRole('instructor', 'admin'), registerExternalMedia);

// Route upload local (duoc bat khi local duoc chon hoac la fallback cho Cloudinary)
if (shouldEnableLocalUploadRoutes()) {
  const localStorage = new LocalStorageProvider();

  const upload = multer({
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const uploadDir = process.env.LOCAL_UPLOAD_DIR || './uploads';
        cb(null, uploadDir);
      },
      filename: (_req, _file, cb) => {
        // Will be moved to correct path after validation
        cb(null, `temp-${Date.now()}`);
      },
    }),
  });

  app.put(
    '/api/upload/local/:storageKey(*)',
    // Route local upload danh cho dev: cho phep browser upload truc tiep qua URL tam thoi
    upload.single('file'),
    async (req: Request, res: Response) => {
      const traceId = (req.headers['x-trace-id'] as string) || '';
      const storageKey = decodeURIComponent(req.params.storageKey);

      try {
        if (!req.file) {
          const bad: ApiResponse<null> = {
            success: false, code: 400,
            message: 'No file provided',
            data: null, trace_id: traceId,
          };
          return res.status(400).json(bad);
        }

        // Move temp file to correct storage path
        const fs = await import('fs/promises');
        // Route local phai luon ghi vao filesystem, khong phu thuoc provider dang active.
        const targetPath = localStorage.getAbsolutePath(storageKey);
        const targetDir = path.dirname(targetPath);
        await fs.mkdir(targetDir, { recursive: true });
        await fs.rename(req.file.path, targetPath);

        // Update actual file size in DB
        await prisma.mediaAsset.updateMany({
          where: { storageKey },
          data: { size: req.file.size },
        });

        const response: ApiResponse<{ storageKey: string; size: number }> = {
          success: true, code: 200,
          message: 'File uploaded successfully',
          data: { storageKey, size: req.file.size },
          trace_id: traceId,
        };
        return res.status(200).json(response);
      } catch (err) {
        logger.error({ err }, 'local upload error');
        const serverError: ApiResponse<null> = {
          success: false, code: 500,
          message: 'Failed to save file',
          data: null, trace_id: traceId,
        };
        return res.status(500).json(serverError);
      }
    },
  );
}

// Route media asset
app.get('/api/media/:id', getMediaAsset);
app.get('/api/media/lesson/:lessonId', getMediaByLesson);
app.get('/api/media/course/:courseId', requireAuth, getMediaByCourse);
app.delete('/api/media/:id', ...requireRole('instructor', 'admin'), deleteMediaAsset);

// Phuc vu file local (duoc bat cung dieu kien voi local upload route)
if (shouldEnableLocalUploadRoutes()) {
  const localStorage = new LocalStorageProvider();

  app.get('/api/media/file/:storageKey(*)', async (req: Request, res: Response) => {
    const storageKey = decodeURIComponent(req.params.storageKey);
    // Endpoint nay chi phuc vu local file, nen khong dung provider cloudinary/s3.
    const filePath = localStorage.getAbsolutePath(storageKey);

    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
      return res.sendFile(filePath);
    } catch {
      const notFound: ApiResponse<null> = {
        success: false, code: 404,
        message: 'File not found',
        data: null, trace_id: (req.headers['x-trace-id'] as string) || '',
      };
      return res.status(404).json(notFound);
    }
  });
}

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  const response: ApiResponse<null> = {
    success: false, code: 404,
    message: `Route ${req.method} ${req.path} not found`,
    data: null,
    trace_id: (req.headers['x-trace-id'] as string) || 'unknown',
  };
  res.status(404).json(response);
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, traceId: req.headers['x-trace-id'] }, 'Unhandled error');
  const response: ApiResponse<null> = {
    success: false, code: 500,
    message: 'Internal server error',
    data: null,
    trace_id: (req.headers['x-trace-id'] as string) || 'unknown',
  };
  res.status(500).json(response);
});

// Khoi dong server
// Tao thu muc uploads neu chua ton tai (local storage)
const uploadDir = process.env.LOCAL_UPLOAD_DIR || './uploads';
fs.mkdir(uploadDir, { recursive: true }).catch(() => {});

const server = app.listen(PORT, () => {
  logger.info(
    { port: PORT, storage: process.env.STORAGE_PROVIDER || 'local' },
    `Media Service da khoi dong tren port ${PORT}`,
  );
});

// Khoi dong Redis cache (Upstash) — non-blocking
if (process.env.CACHE_REDIS_URL) {
  initCache(process.env.CACHE_REDIS_URL).catch((err) => {
    logger.warn({ err }, '[MEDIA-SERVICE] Cache Redis init failed — se chay khong co cache');
  });
} else {
  logger.warn('CACHE_REDIS_URL chua set — bo qua cache layer');
}

// Tat server an toan — giai phong Prisma + cache
const shutdown = async (signal: string) => {
  logger.info(`${signal} - dang tat server`);
  const forceExitTimer = setTimeout(() => process.exit(1), 10_000);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      await closeCache();
      clearTimeout(forceExitTimer);
      logger.info('Server closed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Loi khi dong service');
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.fatal(err, 'Uncaught exception'); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.fatal(err, 'Unhandled rejection'); process.exit(1); });
