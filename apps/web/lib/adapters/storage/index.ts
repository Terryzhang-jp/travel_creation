/**
 * Storage Adapter Factory
 *
 * Creates the appropriate storage adapter based on configuration.
 * Defaults to local storage if no specific adapter is configured.
 * 
 * NOTE: S3 adapter is NOT imported at module level to avoid build-time
 * dependency on @aws-sdk/client-s3 when not in use. S3 adapter is only
 * loaded when STORAGE_ADAPTER=s3 is configured.
 */

import type { StorageAdapter, StorageAdapterConfig } from './types';
import { StorageAdapterError } from './types';
import { LocalStorageAdapter } from './local-adapter';

// Re-export types
export type {
  StorageAdapter,
  StorageAdapterConfig,
  UploadOptions,
  UploadResult,
  FileInfo,
} from './types';
export { StorageAdapterError } from './types';

// Singleton instance
let storageAdapterInstance: StorageAdapter | null = null;
let initializationPromise: Promise<StorageAdapter> | null = null;

/**
 * Get storage adapter configuration from environment variables
 */
function getConfigFromEnv(): StorageAdapterConfig {
  const adapterType = (process.env.STORAGE_ADAPTER || 'local') as StorageAdapterConfig['type'];

  switch (adapterType) {
    case 'supabase':
      return {
        type: 'supabase',
        supabase: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
      };

    case 's3':
      return {
        type: 's3',
        s3: {
          endpoint: process.env.S3_ENDPOINT || '',
          region: process.env.S3_REGION || 'auto',
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
        },
      };

    case 'local':
      return {
        type: 'local',
        local: {
          basePath: process.env.LOCAL_STORAGE_PATH || './data/uploads',
          baseUrl: process.env.LOCAL_STORAGE_URL || '/api/storage',
        },
      };

    default:
      throw new StorageAdapterError(
        `Unknown storage adapter type: ${adapterType}`,
        'CONFIG_ERROR'
      );
  }
}

/**
 * Create a storage adapter instance based on configuration (internal async version)
 */
async function createStorageAdapterAsync(config?: StorageAdapterConfig): Promise<StorageAdapter> {
  const resolvedConfig = config || getConfigFromEnv();

  switch (resolvedConfig.type) {
    case 'supabase':
      // Lazy import to avoid loading if not used
      const { SupabaseStorageAdapter } = await import('./supabase-adapter');
      return new SupabaseStorageAdapter(resolvedConfig.supabase);

    case 's3':
      // Dynamic import to avoid requiring @aws-sdk/client-s3 at build time
      const { S3StorageAdapter } = await import('./s3-adapter');
      return new S3StorageAdapter(resolvedConfig.s3);

    case 'local':
      return new LocalStorageAdapter(resolvedConfig.local);

    default:
      throw new StorageAdapterError(
        `Unknown storage adapter type: ${(resolvedConfig as StorageAdapterConfig).type}`,
        'CONFIG_ERROR'
      );
  }
}

/**
 * Initialize the storage adapter (call this early in app startup if using S3)
 */
export async function initializeStorageAdapter(): Promise<StorageAdapter> {
  if (storageAdapterInstance) {
    return storageAdapterInstance;
  }

  if (!initializationPromise) {
    initializationPromise = createStorageAdapterAsync().then(adapter => {
      storageAdapterInstance = adapter;
      return adapter;
    });
  }

  return initializationPromise;
}

/**
 * Get the singleton storage adapter instance (SYNC version)
 *
 * Creates the adapter on first call. For adapters that require async
 * initialization (S3), this will throw if not pre-initialized.
 * 
 * For local and supabase adapters, this creates the instance synchronously.
 */
export function getStorageAdapter(): StorageAdapter {
  if (storageAdapterInstance) {
    return storageAdapterInstance;
  }

  const config = getConfigFromEnv();

  // For local adapter, we can create synchronously
  if (config.type === 'local') {
    storageAdapterInstance = new LocalStorageAdapter(config.local);
    return storageAdapterInstance;
  }

  // For supabase, also synchronous (it's already imported)
  if (config.type === 'supabase') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseStorageAdapter } = require('./supabase-adapter');
    storageAdapterInstance = new SupabaseStorageAdapter(config.supabase);
    return storageAdapterInstance;
  }

  // For S3, we need async initialization - trigger it and throw helpful error
  if (config.type === 's3') {
    // Start loading in background
    initializeStorageAdapter();
    throw new StorageAdapterError(
      'S3 storage adapter requires async initialization. Call initializeStorageAdapter() at app startup.',
      'S3_NOT_INITIALIZED'
    );
  }

  throw new StorageAdapterError(
    `Unknown storage adapter type: ${config.type}`,
    'CONFIG_ERROR'
  );
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetStorageAdapter(): void {
  storageAdapterInstance = null;
  initializationPromise = null;
}

/**
 * Default export: the singleton getter
 */
export default getStorageAdapter;
