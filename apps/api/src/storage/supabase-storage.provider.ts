/**
 * SupabaseStorageProvider
 * Implementation of StorageProvider using @supabase/supabase-js for private bucket management.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageProvider, StorageUploadOptions, StorageUploadResult } from './storage.interface';

export class SupabaseStorageProvider implements StorageProvider {
  private client: SupabaseClient;
  private bucket: string;

  constructor(supabaseUrl: string, serviceRoleKey: string, bucketName: string) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'SupabaseStorageProvider initialization error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
      );
    }
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    this.bucket = bucketName;
  }

  async upload(
    path: string,
    buffer: Buffer,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const { data, error } = await this.client.storage.from(this.bucket).upload(path, buffer, {
      contentType: options.contentType,
      upsert: options.upsert ?? true,
    });

    if (error) {
      throw new Error(`Supabase Storage upload error: ${error.message}`);
    }

    return { path: data.path };
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);

    if (error) {
      throw new Error(`Supabase Storage delete error: ${error.message}`);
    }
  }

  async exists(path: string): Promise<boolean> {
    const pathParts = path.split('/');
    const fileName = pathParts.pop();
    const folder = pathParts.join('/');

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { search: fileName });

    if (error || !data) return false;
    return data.some((file) => file.name === fileName);
  }

  async getSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Supabase Storage signed URL error: ${error?.message || 'Failed to generate signed URL'}`
      );
    }

    return data.signedUrl;
  }
}
