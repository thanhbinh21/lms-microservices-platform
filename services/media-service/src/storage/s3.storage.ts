import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import mime from 'mime-types';
import type { StorageProvider } from './storage.interface';

/**
 * AWS S3 storage provider cho moi truong production.
 * Dung presigned URLs de client upload truc tiep len S3
 * ma khong can truyen file bytes qua media-service.
 * Yeu cau env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET
 */
export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private presignedExpiry: number; // seconds

  constructor() {
    this.region = process.env.AWS_REGION || 'ap-southeast-1';
    this.bucket = process.env.S3_BUCKET || 'lms-media-bucket';
    this.presignedExpiry = Number(process.env.S3_PRESIGNED_EXPIRY) || 3600;

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async generateUploadUrl(params: {
    filename: string;
    mimeType: string;
    folder: string;
  }): Promise<{ presignedUrl: string; storageKey: string; expiresAt: Date }> {
    const ext = mime.extension(params.mimeType) || path.extname(params.filename).slice(1) || 'bin';
    const storageKey = `${params.folder}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: params.mimeType,
    });

    const presignedUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.presignedExpiry,
    });

    const expiresAt = new Date(Date.now() + this.presignedExpiry * 1000);

    return { presignedUrl, storageKey, expiresAt };
  }

  async getFileUrl(storageKey: string): Promise<string> {
    // Bucket cong khai: tra URL truc tiep. Bucket rieng tu: tao GET presigned URL
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: this.presignedExpiry,
    });
  }

  async deleteFile(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    await this.client.send(command);
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}
