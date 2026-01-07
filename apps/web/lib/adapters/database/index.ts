/**
 * Database Adapter Factory
 *
 * Creates the appropriate database adapter based on configuration.
 * Defaults to Supabase if no specific adapter is configured.
 */

import type { DatabaseAdapter, DatabaseAdapterConfig } from './types';
import { DatabaseAdapterError } from './types';
import { SupabaseDatabaseAdapter } from './supabase/adapter';
import { DrizzleSqliteAdapter } from './drizzle/sqlite-adapter';

// Re-export types
export type {
  DatabaseAdapter,
  DatabaseAdapterConfig,
  QueryOptions,
  PhotoFilters,
  CreateUserInput,
  UpdateUserInput,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreatePhotoInput,
  UpdatePhotoInput,
  CreateLocationInput,
  UpdateLocationInput,
  CreateTripInput,
  UpdateTripInput,
  CreateCanvasInput,
  UpdateCanvasInput,
  CreateAiMagicHistoryInput,
  PhotoEmbedding,
  CreatePhotoEmbeddingInput,
} from './types';
export { DatabaseAdapterError } from './types';

// Singleton instance and initialization promise
let databaseAdapterInstance: DatabaseAdapter | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Get database adapter configuration from environment variables
 */
function getConfigFromEnv(): DatabaseAdapterConfig {
  // Default to drizzle-sqlite for local development (no external services needed)
  const adapterType = (process.env.DATABASE_ADAPTER || 'drizzle-sqlite') as DatabaseAdapterConfig['type'];

  switch (adapterType) {
    case 'supabase':
      return {
        type: 'supabase',
        supabase: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
      };

    case 'drizzle-sqlite':
      return {
        type: adapterType,
        drizzle: {
          // Default to ./data/app.db for local SQLite
          connectionString: process.env.DATABASE_URL || 'file:./data/app.db',
        },
      };

    case 'drizzle-pg':
    case 'drizzle-mysql':
      return {
        type: adapterType,
        drizzle: {
          connectionString: process.env.DATABASE_URL || '',
        },
      };

    default:
      throw new DatabaseAdapterError(
        `Unknown database adapter type: ${adapterType}`,
        'CONFIG_ERROR'
      );
  }
}

/**
 * Create a database adapter instance based on configuration
 *
 * @param config - Optional configuration. If not provided, uses environment variables.
 * @returns DatabaseAdapter instance
 */
export function createDatabaseAdapter(config?: DatabaseAdapterConfig): DatabaseAdapter {
  const resolvedConfig = config || getConfigFromEnv();

  switch (resolvedConfig.type) {
    case 'supabase':
      return new SupabaseDatabaseAdapter(resolvedConfig.supabase);

    case 'drizzle-sqlite': {
      const adapter = new DrizzleSqliteAdapter(resolvedConfig.drizzle);
      // Initialize database tables - store promise to await later
      initializationPromise = adapter.initialize();
      return adapter;
    }

    case 'drizzle-pg':
    case 'drizzle-mysql':
      // PostgreSQL and MySQL adapters not yet implemented
      throw new DatabaseAdapterError(
        `Drizzle adapter (${resolvedConfig.type}) is not yet implemented. ` +
        'Please use supabase or drizzle-sqlite adapter.',
        'NOT_IMPLEMENTED'
      );

    default:
      throw new DatabaseAdapterError(
        `Unknown database adapter type: ${(resolvedConfig as DatabaseAdapterConfig).type}`,
        'CONFIG_ERROR'
      );
  }
}

/**
 * Get the singleton database adapter instance
 *
 * Creates the adapter on first call, returns cached instance on subsequent calls.
 * Uses environment variables for configuration.
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (!databaseAdapterInstance) {
    databaseAdapterInstance = createDatabaseAdapter();
  }
  return databaseAdapterInstance;
}

/**
 * Ensure the database adapter is fully initialized
 *
 * Call this before performing any database operations to ensure
 * migrations and table creation have completed.
 */
export async function ensureDatabaseReady(): Promise<DatabaseAdapter> {
  const adapter = getDatabaseAdapter();
  if (initializationPromise) {
    await initializationPromise;
  }
  return adapter;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetDatabaseAdapter(): void {
  databaseAdapterInstance = null;
  initializationPromise = null;
}

/**
 * Default export: the singleton getter
 */
export default getDatabaseAdapter;
