/**
 * Storage factory — tra ve StorageProvider phu hop dua tren STORAGE_PROVIDER env.
 * - "local" (mac dinh) -> LocalStorageProvider (files tren disk, chi dev)
 * - "s3" -> S3StorageProvider (AWS S3 presigned URLs, production)
 */
import type { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local.storage';
import { S3StorageProvider } from './s3.storage';

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (instance) return instance;

  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  switch (provider) {
    case 's3':
      instance = new S3StorageProvider();
      break;
    case 'local':
    default:
      instance = new LocalStorageProvider();
      break;
  }

  return instance;
}

export type { StorageProvider };
