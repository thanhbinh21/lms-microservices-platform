/**
 * Interface storage abstraction.
 * Cai dat: LocalStorageProvider (dev), S3StorageProvider (prod)
 * Cho phep doi storage ma khong sua logic controller.
 */
export interface StorageProvider {
  /** Tao presigned URL de upload (S3) hoac tra endpoint path (local) */
  generateUploadUrl(params: {
    filename: string;
    mimeType: string;
    folder: string;
  }): Promise<{ presignedUrl: string; storageKey: string; expiresAt: Date }>;

  /** Lay URL cong khai de truy cap file */
  getFileUrl(storageKey: string): Promise<string>;

  /** Xoa file khoi storage */
  deleteFile(storageKey: string): Promise<void>;

  /** Kiem tra file ton tai trong storage */
  fileExists(storageKey: string): Promise<boolean>;
}
