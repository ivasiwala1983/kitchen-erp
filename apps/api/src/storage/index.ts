/**
 * Storage Module Entry Point
 * Exposes StorageProvider interface and factory for obtaining active storage provider singleton.
 */

import { StorageProvider } from './storage.interface';
import { SupabaseStorageProvider } from './supabase-storage.provider';
import { config } from '../config/env';

export * from './storage.interface';
export * from './supabase-storage.provider';

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const supabaseUrl = config.supabaseUrl;
    const serviceRoleKey = config.supabaseServiceRoleKey;
    const bucket = config.supabaseStorageBucket || 'kitchen-erp-invoices';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Supabase Storage environment variables missing. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
      );
    }

    storageInstance = new SupabaseStorageProvider(supabaseUrl, serviceRoleKey, bucket);
  }
  return storageInstance;
}

export function setStorageProvider(provider: StorageProvider | null): void {
  storageInstance = provider;
}
