/**
 * Local File System Storage Adapter
 *
 * Implementation of StorageAdapter using local file system.
 * Useful for:
 * - Local development without cloud dependencies
 * - Self-hosted deployments
 * - Testing and CI environments
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  StorageAdapter,
  UploadOptions,
  UploadResult,
  FileInfo,
  StorageAdapterConfig,
} from './types';
import { StorageAdapterError } from './types';

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;
  private baseUrl: string;

  constructor(config: StorageAdapterConfig['local']) {
    if (!config?.basePath || !config?.baseUrl) {
      throw new StorageAdapterError(
        'Local storage basePath and baseUrl are required',
        'CONFIG_ERROR'
      );
    }

    this.basePath = config.basePath;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get the full file path for a bucket and path
   */
  private getFilePath(bucket: string, filePath: string): string {
    // Sanitize path to prevent directory traversal
    const sanitizedBucket = bucket.replace(/\.\./g, '').replace(/^\/+/, '');
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '');

    return path.join(this.basePath, sanitizedBucket, sanitizedPath);
  }

  async upload(
    bucket: string,
    filePath: string,
    file: Buffer,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const fullPath = this.getFilePath(bucket, filePath);
    const dirPath = path.dirname(fullPath);

    try {
      // Ensure directory exists
      await this.ensureDir(dirPath);

      // Check if file exists and upsert is false
      if (!options?.upsert) {
        try {
          await fs.access(fullPath);
          throw new StorageAdapterError(
            'File already exists. Set upsert: true to overwrite.',
            'FILE_EXISTS'
          );
        } catch (error) {
          // File doesn't exist, which is what we want
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }

      // Write file - convert Buffer to Uint8Array for type compatibility
      await fs.writeFile(fullPath, new Uint8Array(file));

      // Store metadata in a companion file (optional, for content-type tracking)
      if (options?.contentType) {
        const metaPath = `${fullPath}.meta.json`;
        await fs.writeFile(
          metaPath,
          JSON.stringify({
            contentType: options.contentType,
            cacheControl: options.cacheControl,
            createdAt: new Date().toISOString(),
          })
        );
      }

      const publicUrl = this.getPublicUrl(bucket, filePath);

      return {
        path: filePath,
        publicUrl,
      };
    } catch (error) {
      if (error instanceof StorageAdapterError) {
        throw error;
      }
      throw new StorageAdapterError(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPLOAD_ERROR',
        error
      );
    }
  }

  getPublicUrl(bucket: string, filePath: string): string {
    // Build URL: baseUrl/bucket/path
    const sanitizedBucket = bucket.replace(/\.\./g, '').replace(/^\/+/, '');
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '');

    return `${this.baseUrl}/${sanitizedBucket}/${sanitizedPath}`;
  }

  async delete(bucket: string, filePath: string): Promise<void> {
    const fullPath = this.getFilePath(bucket, filePath);

    try {
      await fs.unlink(fullPath);

      // Also try to delete metadata file if it exists
      try {
        await fs.unlink(`${fullPath}.meta.json`);
      } catch {
        // Ignore if meta file doesn't exist
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, consider it deleted
        return;
      }
      throw new StorageAdapterError(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_ERROR',
        error
      );
    }
  }

  async deleteMany(bucket: string, paths: string[]): Promise<void> {
    const errors: Error[] = [];

    await Promise.all(
      paths.map(async (filePath) => {
        try {
          await this.delete(bucket, filePath);
        } catch (error) {
          errors.push(error as Error);
        }
      })
    );

    if (errors.length > 0) {
      throw new StorageAdapterError(
        `Failed to delete ${errors.length} files`,
        'DELETE_ERROR',
        errors
      );
    }
  }

  async list(bucket: string, prefix: string): Promise<FileInfo[]> {
    const dirPath = this.getFilePath(bucket, prefix);

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const files: FileInfo[] = [];

      for (const entry of entries) {
        // Skip metadata files and directories
        if (entry.name.endsWith('.meta.json')) continue;

        const filePath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const stats = await fs.stat(filePath);

          // Try to read metadata
          let contentType: string | undefined;
          try {
            const metaContent = await fs.readFile(`${filePath}.meta.json`, 'utf-8');
            const meta = JSON.parse(metaContent);
            contentType = meta.contentType;
          } catch {
            // No metadata file
          }

          files.push({
            name: entry.name,
            path: prefix ? `${prefix}/${entry.name}` : entry.name,
            size: stats.size,
            lastModified: stats.mtime,
            contentType,
          });
        }
      }

      return files;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist, return empty array
        return [];
      }
      throw new StorageAdapterError(
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_ERROR',
        error
      );
    }
  }

  async exists(bucket: string, filePath: string): Promise<boolean> {
    const fullPath = this.getFilePath(bucket, filePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
