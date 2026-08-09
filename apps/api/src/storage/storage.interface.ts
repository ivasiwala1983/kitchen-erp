/**
 * StorageProvider Interface
 * Abstraction layer for file storage systems (Supabase Storage, SeaweedFS, S3, etc.)
 */

export interface StorageUploadOptions {
  contentType: string;
  upsert?: boolean;
}

export interface StorageUploadResult {
  path: string;
}

export interface StorageProvider {
  /**
   * Upload a file buffer to storage path
   */
  upload(path: string, buffer: Buffer, options: StorageUploadOptions): Promise<StorageUploadResult>;

  /**
   * Delete a file from storage path
   */
  delete(path: string): Promise<void>;

  /**
   * Check if a file exists at storage path
   */
  exists(path: string): Promise<boolean>;

  /**
   * Generate a short-lived signed URL for private bucket access
   */
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}
