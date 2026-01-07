/**
 * S3-Compatible Storage Adapter
 *
 * Implementation of StorageAdapter using AWS S3 or S3-compatible services:
 * - AWS S3
 * - MinIO
 * - Cloudflare R2
 * - DigitalOcean Spaces
 * - Backblaze B2
 *
 * NOTE: This adapter requires @aws-sdk/client-s3 to be installed:
 *   pnpm add @aws-sdk/client-s3
 */

import type {
  StorageAdapter,
  UploadOptions,
  UploadResult,
  FileInfo,
  StorageAdapterConfig,
} from './types';
import { StorageAdapterError } from './types';

// S3 client is dynamically imported to avoid requiring the SDK when not used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S3ClientType = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S3Object = any;

export class S3StorageAdapter implements StorageAdapter {
  private client: S3ClientType | null = null;
  private config: NonNullable<StorageAdapterConfig['s3']>;
  private initialized = false;

  constructor(config: StorageAdapterConfig['s3']) {
    if (!config) {
      throw new StorageAdapterError('S3 configuration is required', 'CONFIG_ERROR');
    }

    if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey) {
      throw new StorageAdapterError(
        'S3 endpoint, accessKeyId, and secretAccessKey are required',
        'CONFIG_ERROR'
      );
    }

    this.config = config;
  }

  private async getClient(): Promise<S3ClientType> {
    if (this.client && this.initialized) {
      return this.client;
    }

    try {
      // @ts-expect-error - @aws-sdk/client-s3 is an optional peer dependency
      const { S3Client } = await import('@aws-sdk/client-s3');

      this.client = new S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region || 'auto',
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        forcePathStyle: this.config.forcePathStyle ?? true,
      });

      this.initialized = true;
      return this.client;
    } catch (error) {
      throw new StorageAdapterError(
        'Failed to initialize S3 client. Make sure @aws-sdk/client-s3 is installed: pnpm add @aws-sdk/client-s3',
        'INIT_ERROR',
        error
      );
    }
  }

  async upload(
    bucket: string,
    path: string,
    file: Buffer,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const client = await this.getClient();

    try {
      // @ts-expect-error - @aws-sdk/client-s3 is an optional peer dependency
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: file,
        ContentType: options?.contentType,
        CacheControl: options?.cacheControl || 'max-age=3600',
        ACL: 'public-read',
      });

      await client.send(command);

      const publicUrl = this.getPublicUrl(bucket, path);

      return {
        path,
        publicUrl,
      };
    } catch (error) {
      throw new StorageAdapterError(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPLOAD_ERROR',
        error
      );
    }
  }

  getPublicUrl(bucket: string, path: string): string {
    // Build public URL based on endpoint configuration
    const endpoint = this.config.endpoint.replace(/\/$/, '');

    if (this.config.forcePathStyle !== false) {
      // Path-style URL: https://endpoint/bucket/path
      return `${endpoint}/${bucket}/${path}`;
    } else {
      // Virtual-hosted style URL: https://bucket.endpoint/path
      const url = new URL(endpoint);
      url.hostname = `${bucket}.${url.hostname}`;
      return `${url.origin}/${path}`;
    }
  }

  async delete(bucket: string, path: string): Promise<void> {
    const client = await this.getClient();

    try {
      // @ts-expect-error - @aws-sdk/client-s3 is an optional peer dependency
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: path,
      });

      await client.send(command);
    } catch (error) {
      throw new StorageAdapterError(
        `Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_ERROR',
        error
      );
    }
  }

  async deleteMany(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const client = await this.getClient();

    try {
      // @ts-expect-error - @aws-sdk/client-s3 is an optional peer dependency
      const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: paths.map((p) => ({ Key: p })),
        },
      });

      await client.send(command);
    } catch (error) {
      throw new StorageAdapterError(
        `Failed to delete files from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_ERROR',
        error
      );
    }
  }

  async list(bucket: string, prefix: string): Promise<FileInfo[]> {
    const client = await this.getClient();

    try {
      // @ts-expect-error - @aws-sdk/client-s3 is an optional peer dependency
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      });

      const response = await client.send(command);

      return (response.Contents || []).map((object: S3Object) => ({
        name: object.Key?.split('/').pop() || '',
        path: object.Key || '',
        size: object.Size,
        lastModified: object.LastModified,
        contentType: undefined, // S3 list doesn't return content type
      }));
    } catch (error) {
      throw new StorageAdapterError(
        `Failed to list files from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_ERROR',
        error
      );
    }
  }

  async exists(bucket: string, path: string): Promise<boolean> {
    const client = await this.getClient();

    try {
      // @ts-expect-error - @aws-sdk/client-s3 is an optional peer dependency
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: path,
      });

      await client.send(command);
      return true;
    } catch (error) {
      // NotFound error means file doesn't exist
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      // For other errors, assume file doesn't exist
      return false;
    }
  }
}
