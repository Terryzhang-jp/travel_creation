/**
 * Supabase Storage Adapter
 *
 * Implementation of StorageAdapter using Supabase Storage.
 * This is the default adapter for production deployments using Supabase.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  StorageAdapter,
  UploadOptions,
  UploadResult,
  FileInfo,
  StorageAdapterConfig,
} from './types';
import { StorageAdapterError } from './types';

export class SupabaseStorageAdapter implements StorageAdapter {
  private client: SupabaseClient;

  constructor(config: StorageAdapterConfig['supabase']) {
    if (!config?.url || !config?.serviceRoleKey) {
      throw new StorageAdapterError(
        'Supabase URL and service role key are required',
        'CONFIG_ERROR'
      );
    }

    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async upload(
    bucket: string,
    path: string,
    file: Buffer,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const { data, error } = await this.client.storage.from(bucket).upload(path, file, {
      contentType: options?.contentType,
      cacheControl: options?.cacheControl || '3600',
      upsert: options?.upsert || false,
    });

    if (error) {
      throw new StorageAdapterError(
        `Failed to upload file: ${error.message}`,
        'UPLOAD_ERROR',
        error
      );
    }

    const publicUrl = this.getPublicUrl(bucket, path);

    return {
      path: data.path,
      publicUrl,
    };
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async delete(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);

    if (error) {
      throw new StorageAdapterError(
        `Failed to delete file: ${error.message}`,
        'DELETE_ERROR',
        error
      );
    }
  }

  async deleteMany(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const { error } = await this.client.storage.from(bucket).remove(paths);

    if (error) {
      throw new StorageAdapterError(
        `Failed to delete files: ${error.message}`,
        'DELETE_ERROR',
        error
      );
    }
  }

  async list(bucket: string, prefix: string): Promise<FileInfo[]> {
    const { data, error } = await this.client.storage.from(bucket).list(prefix);

    if (error) {
      throw new StorageAdapterError(
        `Failed to list files: ${error.message}`,
        'LIST_ERROR',
        error
      );
    }

    return (data || []).map((file) => ({
      name: file.name,
      path: prefix ? `${prefix}/${file.name}` : file.name,
      size: file.metadata?.size,
      lastModified: file.updated_at ? new Date(file.updated_at) : undefined,
      contentType: file.metadata?.mimetype,
    }));
  }

  async exists(bucket: string, path: string): Promise<boolean> {
    // Extract directory and filename from path
    const lastSlash = path.lastIndexOf('/');
    const prefix = lastSlash > 0 ? path.substring(0, lastSlash) : '';
    const filename = lastSlash > 0 ? path.substring(lastSlash + 1) : path;

    const { data, error } = await this.client.storage.from(bucket).list(prefix, {
      search: filename,
    });

    if (error) {
      return false;
    }

    return data?.some((file) => file.name === filename) || false;
  }
}
