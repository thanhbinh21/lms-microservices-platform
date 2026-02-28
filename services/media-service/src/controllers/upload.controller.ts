import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import { getStorageProvider } from '../storage';

// Schema yeu cau presigned URL
const presignedUploadSchema = z.object({
  filename: z.string().min(1, 'Ten file la bat buoc'),
  mimeType: z.string().min(1, 'MIME type la bat buoc'),
  size: z.number().int().min(1, 'Kich thuoc file phai > 0').max(100 * 1024 * 1024, 'File vuot qua 100MB'),
  type: z.enum(['VIDEO', 'IMAGE', 'DOCUMENT']).default('VIDEO'),
  courseId: z.string().uuid('Course ID khong hop le').optional(),
  lessonId: z.string().uuid('Lesson ID khong hop le').optional(),
});

// Schema xac nhan upload
const confirmUploadSchema = z.object({
  mediaId: z.string().uuid('Media ID khong hop le'),
});

// MIME types cho phep theo loai media
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/upload/presigned
 * Tao presigned URL de client upload truc tiep.
 * Luong: Validate input -> Tao presigned URL -> Luu MediaAsset (PENDING) -> Tra URL
 */
export async function requestPresignedUpload(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const uploaderId = res.locals.userId as string;

  try {
    const parsed = presignedUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      const bad: ApiResponse<null> = {
        success: false, code: 400,
        message: parsed.error.errors[0].message,
        data: null, trace_id: traceId,
      };
      return res.status(400).json(bad);
    }

    const { filename, mimeType, size, type, courseId, lessonId } = parsed.data;

    // Kiem tra MIME type
    const allowedTypes = ALLOWED_MIME_TYPES[type];
    if (!allowedTypes || !allowedTypes.includes(mimeType)) {
      const bad: ApiResponse<null> = {
        success: false, code: 400,
        message: `Invalid MIME type "${mimeType}" for ${type}. Allowed: ${allowedTypes?.join(', ') ?? 'none'}`,
        data: null, trace_id: traceId,
      };
      return res.status(400).json(bad);
    }

    // Tao duong dan thu muc luu tru
    const folder = courseId
      ? `courses/${courseId}${lessonId ? `/lessons/${lessonId}` : ''}`
      : `uploads/${uploaderId}`;

    // Tao presigned URL tu storage provider
    const storage = getStorageProvider();
    const { presignedUrl, storageKey, expiresAt } = await storage.generateUploadUrl({
      filename,
      mimeType,
      folder,
    });

    // Tao ban ghi MediaAsset voi trang thai PENDING
    const media = await prisma.mediaAsset.create({
      data: {
        filename,
        storageKey,
        mimeType,
        size,
        type,
        status: 'PENDING',
        uploaderId,
        courseId: courseId ?? null,
        lessonId: lessonId ?? null,
        presignedUrl,
        presignedExp: expiresAt,
      },
    });

    const response: ApiResponse<{
      mediaId: string;
      presignedUrl: string;
      storageKey: string;
      expiresAt: string;
    }> = {
      success: true, code: 201,
      message: 'Presigned upload URL generated',
      data: {
        mediaId: media.id,
        presignedUrl,
        storageKey,
        expiresAt: expiresAt.toISOString(),
      },
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const bad: ApiResponse<null> = {
        success: false, code: 400,
        message: err.errors[0].message,
        data: null, trace_id: traceId,
      };
      return res.status(400).json(bad);
    }
    return handlePrismaError(err, res, traceId, 'requestPresignedUpload');
  }
}

/**
 * POST /api/upload/complete
 * Xac nhan upload hoan tat. Cap nhat trang thai PENDING -> UPLOADED.
 */
export async function confirmUpload(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const uploaderId = res.locals.userId as string;

  try {
    const parsed = confirmUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      const bad: ApiResponse<null> = {
        success: false, code: 400,
        message: parsed.error.errors[0].message,
        data: null, trace_id: traceId,
      };
      return res.status(400).json(bad);
    }

    const { mediaId } = parsed.data;

    // Tim media asset dang PENDING
    const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });

    if (!media) {
      const notFound: ApiResponse<null> = {
        success: false, code: 404,
        message: 'Media asset not found',
        data: null, trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    if (media.uploaderId !== uploaderId) {
      const forbidden: ApiResponse<null> = {
        success: false, code: 403,
        message: 'Forbidden — not your upload',
        data: null, trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    if (media.status !== 'PENDING') {
      const conflict: ApiResponse<null> = {
        success: false, code: 409,
        message: `Upload already ${media.status.toLowerCase()}`,
        data: null, trace_id: traceId,
      };
      return res.status(409).json(conflict);
    }

    // Kiem tra presigned URL da het han chua
    if (media.presignedExp && media.presignedExp < new Date()) {
      await prisma.mediaAsset.update({
        where: { id: mediaId },
        data: { status: 'FAILED' },
      });
      const expired: ApiResponse<null> = {
        success: false, code: 410,
        message: 'Upload URL has expired. Please request a new one.',
        data: null, trace_id: traceId,
      };
      return res.status(410).json(expired);
    }

    // Kiem tra file ton tai trong storage (local: bat buoc, S3: bo qua do eventual consistency)
    const storage = getStorageProvider();
    const exists = await storage.fileExists(media.storageKey);
    const isLocal = (process.env.STORAGE_PROVIDER || 'local') === 'local';
    if (isLocal && !exists) {
      const missing: ApiResponse<null> = {
        success: false, code: 400,
        message: 'File not found in storage. Upload may have failed.',
        data: null, trace_id: traceId,
      };
      return res.status(400).json(missing);
    }

    // Tao public URL va cap nhat trang thai -> UPLOADED
    const url = await storage.getFileUrl(media.storageKey);
    const updated = await prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        status: 'UPLOADED',
        url,
        presignedUrl: null,
        presignedExp: null,
      },
    });

    const response: ApiResponse<typeof updated> = {
      success: true, code: 200,
      message: 'Upload confirmed successfully',
      data: updated,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'confirmUpload');
  }
}
