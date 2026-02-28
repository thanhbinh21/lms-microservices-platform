import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import type { StorageProvider } from './storage.interface';

const DEFAULT_UPLOAD_DIR = './uploads';

/**
 * Storage provider dung file system local cho moi truong dev.
 * Thay vi presigned URL cua S3, provider nay:
 * - Tao URL upload local (POST /api/upload/local/:storageKey)
 * - Luu file vao LOCAL_UPLOAD_DIR
 * - Phuc vu file qua GET /api/media/file/:storageKey
 */
export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    this.uploadDir = process.env.LOCAL_UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
    const port = process.env.PORT || 3004;
    this.baseUrl = `http://localhost:${port}`;
  }

  async generateUploadUrl(params: {
    filename: string;
    mimeType: string;
    folder: string;
  }): Promise<{ presignedUrl: string; storageKey: string; expiresAt: Date }> {
    const ext = mime.extension(params.mimeType) || path.extname(params.filename).slice(1) || 'bin';
    const storageKey = `${params.folder}/${uuidv4()}.${ext}`;

    // Dam bao thu muc ton tai
    const fullDir = path.join(this.uploadDir, params.folder);
    await fs.mkdir(fullDir, { recursive: true });

    // Voi local dev, "presigned URL" la endpoint upload local
    const presignedUrl = `${this.baseUrl}/api/upload/local/${encodeURIComponent(storageKey)}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    return { presignedUrl, storageKey, expiresAt };
  }

  async getFileUrl(storageKey: string): Promise<string> {
    return `${this.baseUrl}/api/media/file/${encodeURIComponent(storageKey)}`;
  }

  async deleteFile(storageKey: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, storageKey);
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      // Bo qua neu file khong ton tai
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async fileExists(storageKey: string): Promise<boolean> {
    const fullPath = path.join(this.uploadDir, storageKey);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /** Lay duong dan tuyet doi toi file (cho local serve) */
  getAbsolutePath(storageKey: string): string {
    return path.resolve(this.uploadDir, storageKey);
  }
}
