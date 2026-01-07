/**
 * Database Adapter Interface
 *
 * Provides a unified interface for database operations,
 * allowing seamless switching between different database backends:
 * - Supabase (PostgreSQL via Supabase SDK)
 * - Drizzle ORM (PostgreSQL, MySQL, SQLite)
 */

import type {
  User,
  Document,
  Photo,
  PhotoCategory,
  PhotoStats,
  Location,
  Trip,
  CanvasProject,
  AiMagicHistoryItem,
  JSONContent,
  CanvasViewport,
  CanvasElement,
  MagazinePage,
} from '@/types/storage';

// ============================================
// Common Types
// ============================================

/**
 * Query options for list operations
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Photo filter options
 */
export interface PhotoFilters {
  category?: PhotoCategory;
  tripId?: string;
  locationId?: string;
  trashed?: boolean;
  isPublic?: boolean;
}

// ============================================
// Input Types for Create/Update Operations
// ============================================

export interface CreateUserInput {
  id?: string;
  email: string;
  passwordHash: string;
  name?: string;
  requirePasswordChange?: boolean;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

export interface UpdateUserInput {
  email?: string;
  passwordHash?: string;
  name?: string;
  requirePasswordChange?: boolean;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

export interface CreateDocumentInput {
  id?: string;
  userId: string;
  tripId?: string;
  title: string;
  content: JSONContent;
  images?: string[];
  tags?: string[];
  preview?: string;
}

export interface UpdateDocumentInput {
  tripId?: string;
  title?: string;
  content?: JSONContent;
  images?: string[];
  tags?: string[];
  preview?: string;
}

export interface CreatePhotoInput {
  id?: string;
  userId: string;
  tripId?: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  locationId?: string;
  metadata: Photo['metadata'];
  category: PhotoCategory;
  title?: string;
  description?: JSONContent;
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdatePhotoInput {
  tripId?: string;
  fileName?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  locationId?: string;
  metadata?: Partial<Photo['metadata']>;
  category?: PhotoCategory;
  title?: string;
  description?: JSONContent;
  tags?: string[];
  isPublic?: boolean;
  trashed?: boolean;
  trashedAt?: string;
  originalFileUrl?: string;
  edited?: boolean;
  editedAt?: string;
}

export interface CreateLocationInput {
  id?: string;
  userId: string;
  name: string;
  coordinates: Location['coordinates'];
  address?: Location['address'];
  placeId?: string;
  category?: string;
  notes?: string;
  isPublic?: boolean;
}

export interface UpdateLocationInput {
  name?: string;
  coordinates?: Location['coordinates'];
  address?: Location['address'];
  placeId?: string;
  category?: string;
  notes?: string;
  usageCount?: number;
  lastUsedAt?: string;
  isPublic?: boolean;
}

export interface CreateTripInput {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  startDate?: string;
  endDate?: string;
  defaultCenter?: Trip['defaultCenter'];
  isPublic?: boolean;
  shareSlug?: string;
}

export interface UpdateTripInput {
  name?: string;
  description?: string;
  coverImageUrl?: string;
  startDate?: string;
  endDate?: string;
  defaultCenter?: Trip['defaultCenter'];
  isPublic?: boolean;
  shareSlug?: string;
  photoCount?: number;
  documentCount?: number;
}

export interface CreateCanvasInput {
  id?: string;
  userId: string;
  title: string;
  viewport?: CanvasViewport;
  elements?: CanvasElement[];
  isMagazineMode?: boolean;
  pages?: MagazinePage[];
  currentPageIndex?: number;
  thumbnailUrl?: string;
}

export interface UpdateCanvasInput {
  title?: string;
  viewport?: CanvasViewport;
  elements?: CanvasElement[];
  isMagazineMode?: boolean;
  pages?: MagazinePage[];
  currentPageIndex?: number;
  thumbnailUrl?: string;
  version?: number;
}

export interface CreateAiMagicHistoryInput {
  id?: string;
  userId: string;
  userPrompt: string;
  inputImageCount: number;
  styleImageCount: number;
  optimizedPrompt: string;
  reasoning?: string;
  resultImage: string;
  model: string;
}

// ============================================
// Photo Embeddings (for AI features)
// ============================================

export interface PhotoEmbedding {
  photoId: string;
  userId: string;
  vector: number[];
  dimension: number;
  createdAt: string;
}

export interface CreatePhotoEmbeddingInput {
  photoId: string;
  userId: string;
  vector: number[];
  dimension: number;
}

// ============================================
// Database Adapter Interface
// ============================================

/**
 * Database Adapter Interface
 *
 * All database implementations must implement this interface.
 * Methods should throw DatabaseAdapterError on failure.
 */
export interface DatabaseAdapter {
  // ----------------------------------------
  // User Operations
  // ----------------------------------------
  users: {
    create(data: CreateUserInput): Promise<User>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findAll(): Promise<User[]>;
    update(id: string, data: UpdateUserInput): Promise<User>;
    delete(id: string): Promise<void>;
  };

  // ----------------------------------------
  // Document Operations
  // ----------------------------------------
  documents: {
    create(data: CreateDocumentInput): Promise<Document>;
    findById(id: string): Promise<Document | null>;
    findByUserId(userId: string, options?: QueryOptions): Promise<Document[]>;
    findByTripId(tripId: string, options?: QueryOptions): Promise<Document[]>;
    update(id: string, data: UpdateDocumentInput): Promise<Document>;
    delete(id: string): Promise<void>;
    search(userId: string, query: string): Promise<Document[]>;
    findByTag(userId: string, tag: string): Promise<Document[]>;
  };

  // ----------------------------------------
  // Photo Operations
  // ----------------------------------------
  photos: {
    create(data: CreatePhotoInput): Promise<Photo>;
    findById(id: string): Promise<Photo | null>;
    findByUserId(userId: string, filters?: PhotoFilters, options?: QueryOptions): Promise<Photo[]>;
    findByTripId(tripId: string, options?: QueryOptions): Promise<Photo[]>;
    findByLocationId(locationId: string): Promise<Photo[]>;
    update(id: string, data: UpdatePhotoInput): Promise<Photo>;
    updateMany(ids: string[], data: UpdatePhotoInput): Promise<void>;
    delete(id: string): Promise<void>;
    deleteMany(ids: string[]): Promise<void>;
    count(userId: string, filters?: PhotoFilters): Promise<number>;
    getStats(userId: string): Promise<PhotoStats>;
    findPublic(options?: QueryOptions): Promise<Photo[]>;
    findTrashed(userId: string): Promise<Photo[]>;
  };

  // ----------------------------------------
  // Location Operations
  // ----------------------------------------
  locations: {
    create(data: CreateLocationInput): Promise<Location>;
    findById(id: string): Promise<Location | null>;
    findByUserId(userId: string, options?: QueryOptions): Promise<Location[]>;
    findPublic(): Promise<Location[]>;
    findAvailable(userId: string): Promise<Location[]>;
    update(id: string, data: UpdateLocationInput): Promise<Location>;
    delete(id: string): Promise<void>;
    search(userId: string, query: string): Promise<Location[]>;
    incrementUsage(id: string): Promise<void>;
    decrementUsage(id: string): Promise<void>;
  };

  // ----------------------------------------
  // Trip Operations
  // ----------------------------------------
  trips: {
    create(data: CreateTripInput): Promise<Trip>;
    findById(id: string): Promise<Trip | null>;
    findByUserId(userId: string, options?: QueryOptions): Promise<Trip[]>;
    findByShareSlug(slug: string): Promise<Trip | null>;
    findPublic(options?: QueryOptions): Promise<Trip[]>;
    update(id: string, data: UpdateTripInput): Promise<Trip>;
    delete(id: string): Promise<void>;
    updateCounts(id: string): Promise<void>;
  };

  // ----------------------------------------
  // Canvas Operations
  // ----------------------------------------
  canvas: {
    create(data: CreateCanvasInput): Promise<CanvasProject>;
    findById(id: string): Promise<CanvasProject | null>;
    findByUserId(userId: string, options?: QueryOptions): Promise<CanvasProject[]>;
    findDefault(userId: string): Promise<CanvasProject | null>;
    update(id: string, data: UpdateCanvasInput): Promise<CanvasProject>;
    delete(id: string): Promise<void>;
    incrementVersion(id: string): Promise<number>;
  };

  // ----------------------------------------
  // AI Magic History Operations
  // ----------------------------------------
  aiMagicHistory: {
    create(data: CreateAiMagicHistoryInput): Promise<AiMagicHistoryItem>;
    findById(id: string): Promise<AiMagicHistoryItem | null>;
    findByUserId(userId: string, options?: QueryOptions): Promise<AiMagicHistoryItem[]>;
    delete(id: string): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
    count(userId: string): Promise<number>;
    deleteOldest(userId: string, keepCount: number): Promise<void>;
  };

  // ----------------------------------------
  // Photo Embeddings Operations
  // ----------------------------------------
  photoEmbeddings: {
    upsert(data: CreatePhotoEmbeddingInput): Promise<PhotoEmbedding>;
    findByUserId(userId: string): Promise<PhotoEmbedding[]>;
    findByPhotoId(photoId: string): Promise<PhotoEmbedding | null>;
    delete(photoId: string): Promise<void>;
  };
}

// ============================================
// Configuration
// ============================================

/**
 * Database adapter configuration
 */
export interface DatabaseAdapterConfig {
  /** Adapter type */
  type: 'supabase' | 'drizzle-pg' | 'drizzle-mysql' | 'drizzle-sqlite';

  /** Supabase-specific config */
  supabase?: {
    url: string;
    serviceRoleKey: string;
  };

  /** Drizzle-specific config */
  drizzle?: {
    connectionString: string;
  };
}

/**
 * Error thrown by database adapters
 */
export class DatabaseAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseAdapterError';
  }
}
