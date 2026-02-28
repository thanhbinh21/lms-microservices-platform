import crypto from 'node:crypto';
import { Request, Response } from 'express';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma';
import { handlePrismaError } from '../lib/prisma-errors';
import { getStorageProvider } from '../storage';

/**
 * GET /api/media/:id
 * Lay thong tin metadata cua media asset
 */
export async function getMediaAsset(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        type: true,
        status: true,
        url: true,
        courseId: true,
        lessonId: true,
        uploaderId: true,
        createdAt: true,
      },
    });

    if (!media) {
      const notFound: ApiResponse<null> = {
        success: false, code: 404,
        message: 'Media asset not found',
        data: null, trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    const response: ApiResponse<typeof media> = {
      success: true, code: 200,
      message: 'Media asset fetched',
      data: media,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getMediaAsset');
  }
}

/**
 * GET /api/media/lesson/:lessonId
 * Lay tat ca media assets cua mot lesson (chi tra UPLOADED)
 */
export async function getMediaByLesson(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  try {
    const assets = await prisma.mediaAsset.findMany({
      where: {
        lessonId: req.params.lessonId,
        status: 'UPLOADED',
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        type: true,
        url: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse<typeof assets> = {
      success: true, code: 200,
      message: 'Lesson media fetched',
      data: assets,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getMediaByLesson');
  }
}

/**
 * GET /api/media/course/:courseId
 * Lay tat ca media assets cua mot course (bao gom PENDING)
 */
export async function getMediaByCourse(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;

  try {
    const assets = await prisma.mediaAsset.findMany({
      where: {
        courseId: req.params.courseId,
        uploaderId: userId,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        type: true,
        status: true,
        url: true,
        lessonId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse<typeof assets> = {
      success: true, code: 200,
      message: 'Course media fetched',
      data: assets,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'getMediaByCourse');
  }
}

/**
 * DELETE /api/media/:id
 * Xoa media asset (file trong storage + ban ghi DB)
 * Admin co the xoa bat ky, instructor chi xoa cua minh
 */
export async function deleteMediaAsset(req: Request, res: Response) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  const userId = res.locals.userId as string;
  const userRole = res.locals.userRole as string;

  try {
    const media = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });

    if (!media) {
      const notFound: ApiResponse<null> = {
        success: false, code: 404,
        message: 'Media asset not found',
        data: null, trace_id: traceId,
      };
      return res.status(404).json(notFound);
    }

    // Admin bypass kiem tra quyen so huu
    if (media.uploaderId !== userId && userRole !== 'admin') {
      const forbidden: ApiResponse<null> = {
        success: false, code: 403,
        message: 'Forbidden — not your media asset',
        data: null, trace_id: traceId,
      };
      return res.status(403).json(forbidden);
    }

    // Xoa file trong storage (neu loi thi bo qua, uu tien xoa ban ghi DB)
    const storage = getStorageProvider();
    try {
      await storage.deleteFile(media.storageKey);
    } catch {
      // Orphan file chap nhan duoc
    }

    // Xoa ban ghi DB
    await prisma.mediaAsset.delete({ where: { id: req.params.id } });

    const response: ApiResponse<null> = {
      success: true, code: 200,
      message: 'Media asset deleted',
      data: null, trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    return handlePrismaError(err, res, traceId, 'deleteMediaAsset');
  }
}
