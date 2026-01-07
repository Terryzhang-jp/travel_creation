/**
 * Storage Adapter Interface
 *
 * Provides a unified interface for file storage operations,
 * allowing seamless switching between different storage backends:
 * - Supabase Storage (default)
 * - S3-compatible storage (AWS S3, MinIO, Cloudflare R2)
 * - Local file system (development/self-hosted)
 */

/**
 * Options for file upload operations
 */
export interface UploadOptions {
  /** MIME type of the file */
  contentType?: string;
  /** Cache-Control header value (default: '3600') */
  cacheControl?: string;
  /** Whether to overwrite existing file (default: false) */
  upsert?: boolean;
}

/**
 * Information about a file in storage
 */
export interface FileInfo {
  /** File name */
  name: string;
  /** Full path in the bucket */
  path: string;
  /** File size in bytes */
  size?: number;
  /** Last modified timestamp */
  lastModified?: Date;
  /** MIME type */
  contentType?: string;
}

/**
 * Result of an upload operation
 */
export interface UploadResult {
  /** The path where the file was stored */
  path: string;
  /** Public URL to access the file */
  publicUrl: string;
}

/**
 * Storage Adapter Interface
 *
 * All storage implementations must implement this interface.
 * Methods should throw StorageAdapterError on failure.
 */
export interface StorageAdapter {
  /**
   * Upload a file to storage
   *
   * @param bucket - The storage bucket name
   * @param path - The path within the bucket (e.g., 'userId/gallery/photo.jpg')
   * @param file - The file content as Buffer
   * @param options - Upload options
   * @returns Upload result with path and public URL
   * @throws StorageAdapterError on failure
   */
  upload(
    bucket: string,
    path: string,
    file: Buffer,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Get the public URL for a file
   *
   * @param bucket - The storage bucket name
   * @param path - The path within the bucket
   * @returns The public URL string
   */
  getPublicUrl(bucket: string, path: string): string;

  /**
   * Delete a file from storage
   *
   * @param bucket - The storage bucket name
   * @param path - The path within the bucket
   * @throws StorageAdapterError on failure
   */
  delete(bucket: string, path: string): Promise<void>;

  /**
   * Delete multiple files from storage
   *
   * @param bucket - The storage bucket name
   * @param paths - Array of paths within the bucket
   * @throws StorageAdapterError on failure
   */
  deleteMany(bucket: string, paths: string[]): Promise<void>;

  /**
   * List files in a directory
   *
   * @param bucket - The storage bucket name
   * @param prefix - The directory prefix to list
   * @returns Array of file information
   * @throws StorageAdapterError on failure
   */
  list(bucket: string, prefix: string): Promise<FileInfo[]>;

  /**
   * Check if a file exists
   *
   * @param bucket - The storage bucket name
   * @param path - The path within the bucket
   * @returns True if the file exists
   */
  exists(bucket: string, path: string): Promise<boolean>;
}

/**
 * Storage adapter configuration
 */
export interface StorageAdapterConfig {
  /** Adapter type */
  type: 'supabase' | 's3' | 'local';

  /** Supabase-specific config */
  supabase?: {
    url: string;
    serviceRoleKey: string;
  };

  /** S3-specific config */
  s3?: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket?: string;
    forcePathStyle?: boolean;
  };

  /** Local storage config */
  local?: {
    basePath: string;
    baseUrl: string;
  };
}

/**
 * Error thrown by storage adapters
 */
export class StorageAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StorageAdapterError';
  }
}
