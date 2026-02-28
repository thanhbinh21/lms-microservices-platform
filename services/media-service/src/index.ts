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
import { requestPresignedUpload, confirmUpload } from './controllers/upload.controller';
import { getMediaAsset, getMediaByLesson, getMediaByCourse, deleteMediaAsset } from './controllers/media.controller';
import { getStorageProvider } from './storage';
import { LocalStorageProvider } from './storage/local.storage';
import prisma from './lib/prisma';

// Validate bien moi truong khi khoi dong
validateMediaServiceEnv();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware bao mat
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Ghi log request
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, traceId: req.headers['x-trace-id'] }, 'Incoming request');
  next();
});

// Kiem tra suc khoe
app.get('/health', (_req: Request, res: Response) => {
  const response: ApiResponse<{ service: string; storage: string }> = {
    success: true, code: 200, message: 'OK',
    data: {
      service: 'media-service',
      storage: process.env.STORAGE_PROVIDER || 'local',
    },
    trace_id: '',
  };
  res.status(200).json(response);
});

// Route upload (chi giang vien/admin)
app.post('/api/upload/presigned', ...requireRole('instructor', 'admin'), requestPresignedUpload);
app.post('/api/upload/complete', ...requireRole('instructor', 'admin'), confirmUpload);

// Route upload local (chi dung khi STORAGE_PROVIDER=local)
if ((process.env.STORAGE_PROVIDER || 'local') === 'local') {
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
    requireAuth,
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
        const storage = getStorageProvider() as LocalStorageProvider;
        const targetPath = storage.getAbsolutePath(storageKey);
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

// Phuc vu file local (chi dung trong dev)
if ((process.env.STORAGE_PROVIDER || 'local') === 'local') {
  app.get('/api/media/file/:storageKey(*)', async (req: Request, res: Response) => {
    const storageKey = decodeURIComponent(req.params.storageKey);
    const storage = getStorageProvider() as LocalStorageProvider;
    const filePath = storage.getAbsolutePath(storageKey);

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

app.listen(PORT, () => {
  logger.info(
    { port: PORT, storage: process.env.STORAGE_PROVIDER || 'local' },
    `Media Service da khoi dong tren port ${PORT}`,
  );
});
