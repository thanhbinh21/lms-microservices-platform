/**
 * Storage factory — tra ve StorageProvider phu hop dua tren STORAGE_PROVIDER env.
 * - "local" (mac dinh) -> LocalStorageProvider (files tren disk, chi dev)
 * - "s3" -> S3StorageProvider (AWS S3 presigned URLs, production)
 * - Neu co CLOUDINARY_URL -> uu tien Cloudinary, fallback local neu khoi tao that bai.
 */
import type { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local.storage';
import { S3StorageProvider } from './s3.storage';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@lms/logger';

type ActiveStorage = 'local' | 's3' | 'cloudinary';

class CloudinaryStorageProvider implements StorageProvider {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    const cloudinaryUrl = (process.env.CLOUDINARY_URL || '').trim();
    if (!cloudinaryUrl) {
      throw new Error('CLOUDINARY_URL is missing');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cloudinaryUrl);
    } catch {
      throw new Error('CLOUDINARY_URL is invalid');
    }

    if (parsedUrl.protocol !== 'cloudinary:') {
      throw new Error('CLOUDINARY_URL must use cloudinary:// scheme');
    }

    const apiKey = parsedUrl.username;
    const apiSecret = parsedUrl.password;
    const cloudName = parsedUrl.hostname;

    if (!apiKey || !apiSecret || !cloudName) {
      throw new Error('CLOUDINARY_URL is invalid');
    }

    this.cloudName = cloudName;
    this.apiKey = decodeURIComponent(apiKey);
    this.apiSecret = decodeURIComponent(apiSecret);

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
  }

  private getResourceType(mimeType: string): 'image' | 'video' | 'raw' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'raw';
  }

  private parseStorageKey(storageKey: string): { resourceType: 'image' | 'video' | 'raw'; publicId: string } {
    const matched = storageKey.match(/^cloudinary\/(image|video|raw)\/(.+)$/);
    if (!matched) {
      throw new Error('Invalid cloudinary storage key format');
    }
    return {
      resourceType: matched[1] as 'image' | 'video' | 'raw',
      publicId: matched[2],
    };
  }

  async generateUploadUrl(params: {
    filename: string;
    mimeType: string;
    folder: string;
  }): Promise<{
    presignedUrl: string;
    storageKey: string;
    expiresAt: Date;
    uploadMethod?: 'POST_FORM';
    uploadFields?: Record<string, string>;
  }> {
    const resourceType = this.getResourceType(params.mimeType);
    const publicIdSuffix = uuidv4();
    const publicId = `${params.folder}/${publicIdSuffix}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((timestamp + 3600) * 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        folder: params.folder,
        public_id: publicIdSuffix,
        timestamp,
      },
      this.apiSecret,
    );

    return {
      presignedUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`,
      storageKey: `cloudinary/${resourceType}/${publicId}`,
      expiresAt,
      uploadMethod: 'POST_FORM',
      uploadFields: {
        api_key: this.apiKey,
        folder: params.folder,
        public_id: publicIdSuffix,
        signature,
        timestamp: String(timestamp),
      },
    };
  }

  async getFileUrl(storageKey: string): Promise<string> {
    const { resourceType, publicId } = this.parseStorageKey(storageKey);
    return cloudinary.url(publicId, {
      secure: true,
      resource_type: resourceType,
    });
  }

  async deleteFile(storageKey: string): Promise<void> {
    const { resourceType, publicId } = this.parseStorageKey(storageKey);

    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const { resourceType, publicId } = this.parseStorageKey(storageKey);
      await cloudinary.api.resource(publicId, { resource_type: resourceType });
      return true;
    } catch {
      return false;
    }
  }
}

let instance: StorageProvider | null = null;
let activeStorage: ActiveStorage = 'local';

function resolveStorageProvider(): StorageProvider {
  const cloudinaryUrl = (process.env.CLOUDINARY_URL || '').trim();
  if (cloudinaryUrl) {
    try {
      activeStorage = 'cloudinary';
      logger.info('Media storage provider: cloudinary (CLOUDINARY_URL)');
      return new CloudinaryStorageProvider();
    } catch (err) {
      activeStorage = 'local';
      logger.warn({ err }, 'Cloudinary init failed, fallback to local storage');
      return new LocalStorageProvider();
    }
  }

  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  switch (provider) {
    case 's3':
      activeStorage = 's3';
      return new S3StorageProvider();
    case 'cloudinary':
      activeStorage = 'local';
      logger.warn('STORAGE_PROVIDER=cloudinary but CLOUDINARY_URL missing, fallback to local storage');
      return new LocalStorageProvider();
    case 'local':
    default:
      activeStorage = 'local';
      return new LocalStorageProvider();
  }
}

export function getStorageProvider(): StorageProvider {
  if (!instance) {
    instance = resolveStorageProvider();
  }
  return instance;
}

export function getActiveStorageProvider(): ActiveStorage {
  if (!instance) {
    instance = resolveStorageProvider();
  }
  return activeStorage;
}

export function shouldEnableLocalUploadRoutes(): boolean {
  const configuredProvider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  const hasCloudinaryUrl = Boolean((process.env.CLOUDINARY_URL || '').trim());

  // Bat route local de fallback khi Cloudinary gap loi runtime.
  return configuredProvider === 'local' || configuredProvider === 'cloudinary' || hasCloudinaryUrl;
}

export function forceLocalStorageFallback(err: unknown): StorageProvider {
  activeStorage = 'local';
  instance = new LocalStorageProvider();
  logger.warn({ err }, 'Media storage switched to local fallback');
  return instance;
}

export type { StorageProvider };
