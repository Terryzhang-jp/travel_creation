/**
 * Drizzle SQLite Database Adapter
 *
 * Implementation of DatabaseAdapter using Drizzle ORM with SQLite (libsql).
 * Suitable for local development and self-hosted deployments.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq, desc, asc, like, or, and, sql, inArray } from 'drizzle-orm';
import type {
  User,
  Document,
  Photo,
  PhotoStats,
  Location,
  Trip,
  CanvasProject,
  AiMagicHistoryItem,
} from '@/types/storage';
import type {
  DatabaseAdapter,
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
  PhotoAiMetadataInput,
  PhotoAiMetadataSearchOptions,
  PhotoAiMetadataStats,
} from '../types';
import { DatabaseAdapterError } from '../types';
import * as schema from './schema';

/**
 * Drizzle SQLite Database Adapter (using libsql)
 */
export class DrizzleSqliteAdapter implements DatabaseAdapter {
  private db: LibSQLDatabase<typeof schema>;
  private client: Client;

  constructor(config?: { connectionString?: string }) {
    const dbPath = config?.connectionString || 'file:./data/app.db';

    // Ensure directory exists for local file databases
    if (dbPath.startsWith('file:')) {
      const fs = require('fs');
      const path = require('path');
      const filePath = dbPath.replace('file:', '');
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.client = createClient({ url: dbPath });
    this.db = drizzle(this.client, { schema });
  }

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    // Enable foreign keys
    await this.client.execute('PRAGMA foreign_keys = ON');

    // Create tables if they don't exist - execute each statement separately for libsql
    // NOTE: Better Auth creates and manages the 'user' table
    // Application tables reference 'user' table for foreign keys
    const statements = [
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        trip_id TEXT,
        title TEXT NOT NULL,
        content TEXT,
        images TEXT DEFAULT '[]',
        tags TEXT,
        preview TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        trip_id TEXT,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        thumbnail_url TEXT,
        location_id TEXT,
        metadata TEXT,
        category TEXT NOT NULL,
        title TEXT,
        description TEXT,
        tags TEXT,
        is_public INTEGER DEFAULT 0,
        trashed INTEGER DEFAULT 0,
        trashed_at TEXT,
        original_file_url TEXT,
        edited INTEGER DEFAULT 0,
        edited_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        coordinates TEXT NOT NULL,
        address TEXT,
        place_id TEXT,
        category TEXT,
        notes TEXT,
        usage_count INTEGER DEFAULT 0,
        last_used_at TEXT,
        is_public INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        cover_image_url TEXT,
        start_date TEXT,
        end_date TEXT,
        default_center TEXT,
        is_public INTEGER DEFAULT 0,
        share_slug TEXT UNIQUE,
        photo_count INTEGER DEFAULT 0,
        document_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS canvas_projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        trip_id TEXT,
        title TEXT NOT NULL,
        viewport TEXT,
        elements TEXT DEFAULT '[]',
        is_magazine_mode INTEGER DEFAULT 1,
        pages TEXT,
        current_page_index INTEGER DEFAULT 0,
        thumbnail_url TEXT,
        version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ai_magic_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        user_prompt TEXT NOT NULL,
        input_image_count INTEGER NOT NULL,
        style_image_count INTEGER NOT NULL,
        optimized_prompt TEXT NOT NULL,
        reasoning TEXT,
        result_image TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS photo_embeddings (
        photo_id TEXT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        vector TEXT NOT NULL,
        dimension INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_documents_trip_id ON documents(trip_id)`,
      `CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_photos_trip_id ON photos(trip_id)`,
      `CREATE INDEX IF NOT EXISTS idx_photos_location_id ON photos(location_id)`,
      `CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trips_share_slug ON trips(share_slug)`,
      `CREATE INDEX IF NOT EXISTS idx_canvas_projects_user_id ON canvas_projects(user_id)`,
      // idx_canvas_projects_trip_id is created after migration adds the column
      `CREATE INDEX IF NOT EXISTS idx_ai_magic_history_user_id ON ai_magic_history(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_photo_embeddings_user_id ON photo_embeddings(user_id)`,
      // ============================================
      // Better Auth Tables (using camelCase columns)
      // ============================================
      `CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT NOT NULL UNIQUE,
        emailVerified INTEGER DEFAULT 0,
        image TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expiresAt TEXT NOT NULL,
        ipAddress TEXT,
        userAgent TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        accountId TEXT NOT NULL,
        providerId TEXT NOT NULL,
        accessToken TEXT,
        refreshToken TEXT,
        accessTokenExpiresAt TEXT,
        refreshTokenExpiresAt TEXT,
        scope TEXT,
        idToken TEXT,
        password TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(userId)`,
      `CREATE INDEX IF NOT EXISTS idx_session_token ON session(token)`,
      `CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(userId)`,
    ];

    for (const stmt of statements) {
      await this.client.execute(stmt);
    }

    // Run migrations for existing tables (add new columns if they don't exist)
    await this.runMigrations();
  }

  /**
   * Run migrations to add new columns to existing tables
   * SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use try-catch
   */
  private async runMigrations(): Promise<void> {
    // Step 1: Add new columns (may fail if already exists)
    const alterTableMigrations = [
      // Add trip_id to canvas_projects if it doesn't exist
      `ALTER TABLE canvas_projects ADD COLUMN trip_id TEXT`,
    ];

    for (const migration of alterTableMigrations) {
      try {
        await this.client.execute(migration);
        console.log(`[SQLite Migration] Success: ${migration.substring(0, 50)}...`);
      } catch (error: unknown) {
        // Ignore "duplicate column" errors (column already exists)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('duplicate column') || errorMessage.includes('already exists')) {
          // Column already exists, skip silently
        } else {
          console.error(`[SQLite Migration] Error: ${errorMessage}`);
        }
      }
    }

    // Step 2: Create indexes on new columns (safe to run after columns exist)
    const indexMigrations = [
      `CREATE INDEX IF NOT EXISTS idx_canvas_projects_trip_id ON canvas_projects(trip_id)`,
    ];

    for (const migration of indexMigrations) {
      try {
        await this.client.execute(migration);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SQLite Migration] Index error: ${errorMessage}`);
      }
    }
  }

  // ----------------------------------------
  // User Operations
  // ----------------------------------------

  users = {
    create: async (data: CreateUserInput): Promise<User> => {
      const now = new Date().toISOString();
      const id = data.id || crypto.randomUUID();

      const row = {
        id,
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name || null,
        requirePasswordChange: data.requirePasswordChange || false,
        securityQuestion: data.securityQuestion || null,
        securityAnswerHash: data.securityAnswerHash || null,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(schema.users).values(row);

      return {
        ...row,
        name: row.name || undefined,
        requirePasswordChange: row.requirePasswordChange || false,
        securityQuestion: row.securityQuestion || undefined,
        securityAnswerHash: row.securityAnswerHash || undefined,
      };
    },

    findById: async (id: string): Promise<User | null> => {
      const rows = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        name: row.name || undefined,
        requirePasswordChange: row.requirePasswordChange || false,
        securityQuestion: row.securityQuestion || undefined,
        securityAnswerHash: row.securityAnswerHash || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    findByEmail: async (email: string): Promise<User | null> => {
      const rows = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        name: row.name || undefined,
        requirePasswordChange: row.requirePasswordChange || false,
        securityQuestion: row.securityQuestion || undefined,
        securityAnswerHash: row.securityAnswerHash || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    findAll: async (): Promise<User[]> => {
      const rows = await this.db.select().from(schema.users);
      return rows.map(row => ({
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        name: row.name || undefined,
        requirePasswordChange: row.requirePasswordChange || false,
        securityQuestion: row.securityQuestion || undefined,
        securityAnswerHash: row.securityAnswerHash || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },

    update: async (id: string, data: UpdateUserInput): Promise<User> => {
      const now = new Date().toISOString();

      await this.db.update(schema.users)
        .set({ ...data, updatedAt: now })
        .where(eq(schema.users.id, id));

      const user = await this.users.findById(id);
      if (!user) {
        throw new DatabaseAdapterError('User not found after update', 'NOT_FOUND');
      }
      return user;
    },

    delete: async (id: string): Promise<void> => {
      await this.db.delete(schema.users).where(eq(schema.users.id, id));
    },
  };

  // ----------------------------------------
  // Document Operations
  // ----------------------------------------

  documents = {
    create: async (data: CreateDocumentInput): Promise<Document> => {
      const now = new Date().toISOString();
      const id = data.id || crypto.randomUUID();

      const row = {
        id,
        userId: data.userId,
        tripId: data.tripId || null,
        title: data.title,
        content: data.content as Record<string, unknown>,
        images: data.images || [],
        tags: data.tags || null,
        preview: data.preview || null,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(schema.documents).values(row);

      return {
        id: row.id,
        userId: row.userId,
        tripId: row.tripId || undefined,
        title: row.title,
        content: row.content as Document['content'],
        images: row.images || [],
        tags: row.tags || undefined,
        preview: row.preview || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    findById: async (id: string): Promise<Document | null> => {
      const rows = await this.db.select().from(schema.documents).where(eq(schema.documents.id, id)).limit(1);
      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        userId: row.userId,
        tripId: row.tripId || undefined,
        title: row.title,
        content: row.content as Document['content'],
        images: row.images || [],
        tags: row.tags || undefined,
        preview: row.preview || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    findByUserId: async (userId: string, options?: QueryOptions): Promise<Document[]> => {
      let query = this.db.select().from(schema.documents).where(eq(schema.documents.userId, userId));

      if (options?.orderBy === 'updatedAt') {
        query = query.orderBy(options.orderDirection === 'asc' ? asc(schema.documents.updatedAt) : desc(schema.documents.updatedAt)) as typeof query;
      }
      if (options?.limit) {
        query = query.limit(options.limit) as typeof query;
      }
      if (options?.offset) {
        query = query.offset(options.offset) as typeof query;
      }

      const rows = await query;
      return rows.map(row => ({
        id: row.id,
        userId: row.userId,
        tripId: row.tripId || undefined,
        title: row.title,
        content: row.content as Document['content'],
        images: row.images || [],
        tags: row.tags || undefined,
        preview: row.preview || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },

    findByTripId: async (tripId: string, options?: QueryOptions): Promise<Document[]> => {
      let query = this.db.select().from(schema.documents).where(eq(schema.documents.tripId, tripId));

      if (options?.orderBy === 'updatedAt') {
        query = query.orderBy(options.orderDirection === 'asc' ? asc(schema.documents.updatedAt) : desc(schema.documents.updatedAt)) as typeof query;
      }

      const rows = await query;
      return rows.map(row => ({
        id: row.id,
        userId: row.userId,
        tripId: row.tripId || undefined,
        title: row.title,
        content: row.content as Document['content'],
        images: row.images || [],
        tags: row.tags || undefined,
        preview: row.preview || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },

    update: async (id: string, data: UpdateDocumentInput): Promise<Document> => {
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (data.tripId !== undefined) updateData.tripId = data.tripId || null;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.content !== undefined) updateData.content = data.content;
      if (data.images !== undefined) updateData.images = data.images;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.preview !== undefined) updateData.preview = data.preview;

      await this.db.update(schema.documents).set(updateData).where(eq(schema.documents.id, id));

      const doc = await this.documents.findById(id);
      if (!doc) {
        throw new DatabaseAdapterError('Document not found after update', 'NOT_FOUND');
      }
      return doc;
    },

    delete: async (id: string): Promise<void> => {
      await this.db.delete(schema.documents).where(eq(schema.documents.id, id));
    },

    search: async (userId: string, query: string): Promise<Document[]> => {
      const rows = await this.db.select().from(schema.documents)
        .where(and(
          eq(schema.documents.userId, userId),
          or(
            like(schema.documents.title, `%${query}%`),
            like(schema.documents.preview, `%${query}%`)
          )
        ));

      return rows.map(row => ({
        id: row.id,
        userId: row.userId,
        tripId: row.tripId || undefined,
        title: row.title,
        content: row.content as Document['content'],
        images: row.images || [],
        tags: row.tags || undefined,
        preview: row.preview || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },

    findByTag: async (userId: string, tag: string): Promise<Document[]> => {
      // SQLite JSON search - tags is stored as JSON array
      const rows = await this.db.select().from(schema.documents)
        .where(and(
          eq(schema.documents.userId, userId),
          sql`json_each.value = ${tag}`
        ));

      return rows.map(row => ({
        id: row.id,
        userId: row.userId,
        tripId: row.tripId || undefined,
        title: row.title,
        content: row.content as Document['content'],
        images: row.images || [],
        tags: row.tags || undefined,
        preview: row.preview || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },
  };

  // ----------------------------------------
  // Photo Operations
  // ----------------------------------------

  photos = {
    create: async (data: CreatePhotoInput): Promise<Photo> => {
      const now = new Date().toISOString();
      const id = data.id || crypto.randomUUID();

      const row = {
        id,
        userId: data.userId,
        tripId: data.tripId || null,
        fileName: data.fileName,
        originalName: data.originalName,
        fileUrl: data.fileUrl,
        thumbnailUrl: data.thumbnailUrl || null,
        locationId: data.locationId || null,
        metadata: data.metadata as Record<string, unknown>,
        category: data.category,
        title: data.title || null,
        description: data.description as Record<string, unknown> | null,
        tags: data.tags || null,
        isPublic: data.isPublic || false,
        trashed: false,
        trashedAt: null,
        originalFileUrl: null,
        edited: false,
        editedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(schema.photos).values(row);

      return this.mapPhoto(row);
    },

    findById: async (id: string): Promise<Photo | null> => {
      const rows = await this.db.select().from(schema.photos).where(eq(schema.photos.id, id)).limit(1);
      const row = rows[0];
      if (!row) return null;
      return this.mapPhoto(row);
    },

    findByUserId: async (userId: string, filters?: PhotoFilters, options?: QueryOptions): Promise<Photo[]> => {
      const conditions = [eq(schema.photos.userId, userId)];

      if (filters?.tripId) conditions.push(eq(schema.photos.tripId, filters.tripId));
      if (filters?.locationId) conditions.push(eq(schema.photos.locationId, filters.locationId));
      if (filters?.category) conditions.push(eq(schema.photos.category, filters.category));
      if (filters?.trashed !== undefined) conditions.push(eq(schema.photos.trashed, filters.trashed));
      if (filters?.isPublic !== undefined) conditions.push(eq(schema.photos.isPublic, filters.isPublic));

      let query = this.db.select().from(schema.photos).where(and(...conditions));

      if (options?.orderBy) {
        const column = options.orderBy === 'updatedAt' ? schema.photos.updatedAt : schema.photos.createdAt;
        query = query.orderBy(options.orderDirection === 'asc' ? asc(column) : desc(column)) as typeof query;
      }
      if (options?.limit) query = query.limit(options.limit) as typeof query;
      if (options?.offset) query = query.offset(options.offset) as typeof query;

      const rows = await query;
      return rows.map(row => this.mapPhoto(row));
    },

    findByTripId: async (tripId: string, options?: QueryOptions): Promise<Photo[]> => {
      let query = this.db.select().from(schema.photos).where(eq(schema.photos.tripId, tripId));

      if (options?.orderBy === 'dateTime') {
        query = query.orderBy(options.orderDirection === 'asc' ? asc(schema.photos.createdAt) : desc(schema.photos.createdAt)) as typeof query;
      }
      if (options?.limit) query = query.limit(options.limit) as typeof query;
      if (options?.offset) query = query.offset(options.offset) as typeof query;

      const rows = await query;
      return rows.map(row => this.mapPhoto(row));
    },

    findByLocationId: async (locationId: string): Promise<Photo[]> => {
      const rows = await this.db.select().from(schema.photos).where(eq(schema.photos.locationId, locationId));
      return rows.map(row => this.mapPhoto(row));
    },

    update: async (id: string, data: UpdatePhotoInput): Promise<Photo> => {
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (data.tripId !== undefined) updateData.tripId = data.tripId || null;
      if (data.fileName !== undefined) updateData.fileName = data.fileName;
      if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
      if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl;
      if (data.locationId !== undefined) updateData.locationId = data.locationId || null;
      if (data.metadata !== undefined) updateData.metadata = data.metadata;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
      if (data.trashed !== undefined) updateData.trashed = data.trashed;
      if (data.trashedAt !== undefined) updateData.trashedAt = data.trashedAt;
      if (data.originalFileUrl !== undefined) updateData.originalFileUrl = data.originalFileUrl;
      if (data.edited !== undefined) updateData.edited = data.edited;
      if (data.editedAt !== undefined) updateData.editedAt = data.editedAt;

      await this.db.update(schema.photos).set(updateData).where(eq(schema.photos.id, id));

      const photo = await this.photos.findById(id);
      if (!photo) {
        throw new DatabaseAdapterError('Photo not found after update', 'NOT_FOUND');
      }
      return photo;
    },

    updateMany: async (ids: string[], data: UpdatePhotoInput): Promise<void> => {
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (data.tripId !== undefined) updateData.tripId = data.tripId || null;
      if (data.trashed !== undefined) updateData.trashed = data.trashed;
      if (data.trashedAt !== undefined) updateData.trashedAt = data.trashedAt;

      await this.db.update(schema.photos).set(updateData).where(inArray(schema.photos.id, ids));
    },

    delete: async (id: string): Promise<void> => {
      await this.db.delete(schema.photos).where(eq(schema.photos.id, id));
    },

    deleteMany: async (ids: string[]): Promise<void> => {
      await this.db.delete(schema.photos).where(inArray(schema.photos.id, ids));
    },

    count: async (userId: string, filters?: PhotoFilters): Promise<number> => {
      const conditions = [eq(schema.photos.userId, userId)];
      if (filters?.trashed !== undefined) conditions.push(eq(schema.photos.trashed, filters.trashed));

      const result = await this.db.select({ count: sql<number>`count(*)` })
        .from(schema.photos)
        .where(and(...conditions));

      return result[0]?.count || 0;
    },

    getStats: async (userId: string): Promise<PhotoStats> => {
      const categories = ['time-location', 'time-only', 'location-only', 'neither'] as const;
      const stats: PhotoStats = {
        total: 0,
        byCategory: {
          'time-location': 0,
          'time-only': 0,
          'location-only': 0,
          neither: 0,
        },
      };

      for (const category of categories) {
        const count = await this.photos.count(userId, { category, trashed: false });
        stats.byCategory[category] = count;
        stats.total += count;
      }

      return stats;
    },

    findPublic: async (options?: QueryOptions): Promise<Photo[]> => {
      let query = this.db.select().from(schema.photos)
        .where(and(eq(schema.photos.isPublic, true), eq(schema.photos.trashed, false)));

      if (options?.limit) query = query.limit(options.limit) as typeof query;

      const rows = await query;
      return rows.map(row => this.mapPhoto(row));
    },

    findTrashed: async (userId: string): Promise<Photo[]> => {
      const rows = await this.db.select().from(schema.photos)
        .where(and(eq(schema.photos.userId, userId), eq(schema.photos.trashed, true)));
      return rows.map(row => this.mapPhoto(row));
    },
  };

  private mapPhoto(row: schema.PhotoRow): Photo {
    return {
      id: row.id,
      userId: row.userId,
      tripId: row.tripId || undefined,
      fileName: row.fileName,
      originalName: row.originalName,
      fileUrl: row.fileUrl,
      thumbnailUrl: row.thumbnailUrl || undefined,
      locationId: row.locationId || undefined,
      metadata: row.metadata as Photo['metadata'],
      category: row.category as Photo['category'],
      title: row.title || undefined,
      description: row.description as Photo['description'],
      tags: row.tags || undefined,
      isPublic: row.isPublic || undefined,
      trashed: row.trashed || undefined,
      trashedAt: row.trashedAt || undefined,
      originalFileUrl: row.originalFileUrl || undefined,
      edited: row.edited || undefined,
      editedAt: row.editedAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ----------------------------------------
  // Location Operations
  // ----------------------------------------

  locations = {
    create: async (data: CreateLocationInput): Promise<Location> => {
      const now = new Date().toISOString();
      const id = data.id || crypto.randomUUID();

      const row = {
        id,
        userId: data.userId,
        name: data.name,
        coordinates: data.coordinates,
        address: data.address || null,
        placeId: data.placeId || null,
        category: data.category || null,
        notes: data.notes || null,
        usageCount: 0,
        lastUsedAt: null,
        isPublic: data.isPublic || false,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(schema.locations).values(row);

      return this.mapLocation(row as schema.LocationRow);
    },

    findById: async (id: string): Promise<Location | null> => {
      const rows = await this.db.select().from(schema.locations).where(eq(schema.locations.id, id)).limit(1);
      const row = rows[0];
      if (!row) return null;
      return this.mapLocation(row);
    },

    findByUserId: async (userId: string, options?: QueryOptions): Promise<Location[]> => {
      let query = this.db.select().from(schema.locations).where(eq(schema.locations.userId, userId));

      if (options?.orderBy === 'updatedAt') {
        query = query.orderBy(options.orderDirection === 'asc' ? asc(schema.locations.updatedAt) : desc(schema.locations.updatedAt)) as typeof query;
      }

      const rows = await query;
      return rows.map(row => this.mapLocation(row));
    },

    findPublic: async (): Promise<Location[]> => {
      const rows = await this.db.select().from(schema.locations).where(eq(schema.locations.isPublic, true));
      return rows.map(row => this.mapLocation(row));
    },

    findAvailable: async (userId: string): Promise<Location[]> => {
      const rows = await this.db.select().from(schema.locations)
        .where(or(eq(schema.locations.userId, userId), eq(schema.locations.isPublic, true)));
      return rows.map(row => this.mapLocation(row));
    },

    update: async (id: string, data: UpdateLocationInput): Promise<Location> => {
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.coordinates !== undefined) updateData.coordinates = data.coordinates;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.placeId !== undefined) updateData.placeId = data.placeId;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.usageCount !== undefined) updateData.usageCount = data.usageCount;
      if (data.lastUsedAt !== undefined) updateData.lastUsedAt = data.lastUsedAt;
      if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

      await this.db.update(schema.locations).set(updateData).where(eq(schema.locations.id, id));

      const location = await this.locations.findById(id);
      if (!location) {
        throw new DatabaseAdapterError('Location not found after update', 'NOT_FOUND');
      }
      return location;
    },

    delete: async (id: string): Promise<void> => {
      await this.db.delete(schema.locations).where(eq(schema.locations.id, id));
    },

    search: async (userId: string, query: string): Promise<Location[]> => {
      const rows = await this.db.select().from(schema.locations)
        .where(and(
          or(eq(schema.locations.userId, userId), eq(schema.locations.isPublic, true)),
          like(schema.locations.name, `%${query}%`)
        ));
      return rows.map(row => this.mapLocation(row));
    },

    incrementUsage: async (id: string): Promise<void> => {
      const now = new Date().toISOString();
      await this.db.update(schema.locations)
        .set({
          usageCount: sql`${schema.locations.usageCount} + 1`,
          lastUsedAt: now,
          updatedAt: now
        })
        .where(eq(schema.locations.id, id));
    },

    decrementUsage: async (id: string): Promise<void> => {
      const now = new Date().toISOString();
      await this.db.update(schema.locations)
        .set({
          usageCount: sql`MAX(0, ${schema.locations.usageCount} - 1)`,
          updatedAt: now
        })
        .where(eq(schema.locations.id, id));
    },
  };

  private mapLocation(row: schema.LocationRow): Location {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      coordinates: row.coordinates as Location['coordinates'],
      address: row.address as Location['address'],
      placeId: row.placeId || undefined,
      category: row.category || undefined,
      notes: row.notes || undefined,
      usageCount: row.usageCount || 0,
      lastUsedAt: row.lastUsedAt || undefined,
      isPublic: row.isPublic || false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ----------------------------------------
  // Trip Operations
  // ----------------------------------------

  trips = {
    create: async (data: CreateTripInput): Promise<Trip> => {
      const now = new Date().toISOString();
      const id = data.id || crypto.randomUUID();

      const row = {
        id,
        userId: data.userId,
        name: data.name,
        description: data.description || null,
        coverImageUrl: data.coverImageUrl || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        defaultCenter: data.defaultCenter || null,
        isPublic: data.isPublic || false,
        shareSlug: data.shareSlug || null,
        photoCount: 0,
        documentCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(schema.trips).values(row);

      return this.mapTrip(row as schema.TripRow);
    },

    findById: async (id: string): Promise<Trip | null> => {
      const rows = await this.db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
      const row = rows[0];
      if (!row) return null;
      return this.mapTrip(row);
    },

    findByUserId: async (userId: string, options?: QueryOptions): Promise<Trip[]> => {
      let query = this.db.select().from(schema.trips).where(eq(schema.trips.userId, userId));

      if (options?.orderBy === 'updatedAt') {
        query = query.orderBy(options.orderDirection === 'asc' ? asc(schema.trips.updatedAt) : desc(schema.trips.updatedAt)) as typeof query;
      }

      const rows = await query;
      return rows.map(row => this.mapTrip(row));
    },

    findByShareSlug: async (slug: string): Promise<Trip | null> => {
      const rows = await this.db.select().from(schema.trips).where(eq(schema.trips.shareSlug, slug)).limit(1);
      const row = rows[0];
      if (!row) return null;
      return this.mapTrip(row);
    },

    findPublic: async (options?: QueryOptions): Promise<Trip[]> => {
      let query = this.db.select().from(schema.trips).where(eq(schema.trips.isPublic, true));

      if (options?.orderBy === 'updatedAt') {
        query = query.orderBy(options.orderDirection === 'asc' ? asc(schema.trips.updatedAt) : desc(schema.trips.updatedAt)) as typeof query;
      }
      if (options?.limit) query = query.limit(options.limit) as typeof query;

      const rows = await query;
      return rows.map(row => this.mapTrip(row));
    },

    update: async (id: string, data: UpdateTripInput): Promise<Trip> => {
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
      if (data.startDate !== undefined) updateData.startDate = data.startDate;
      if (data.endDate !== undefined) updateData.endDate = data.endDate;
      if (data.defaultCenter !== undefined) updateData.defaultCenter = data.defaultCenter;
      if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
      if (data.shareSlug !== undefined) updateData.shareSlug = data.shareSlug;
      if (data.photoCount !== undefined) updateData.photoCount = data.photoCount;
      if (data.documentCount !== undefined) updateData.documentCount = data.documentCount;

      await this.db.update(schema.trips).set(updateData).where(eq(schema.trips.id, id));

      const trip = await this.trips.findById(id);
      if (!trip) {
        throw new DatabaseAdapterError('Trip not found after update', 'NOT_FOUND');
      }
      return trip;
    },

    delete: async (id: string): Promise<void> => {
      await this.db.delete(schema.trips).where(eq(schema.trips.id, id));
    },

    updateCounts: async (id: string): Promise<void> => {
      // Count photos
      const photoResult = await this.db.select({ count: sql<number>`count(*)` })
        .from(schema.photos)
        .where(eq(schema.photos.tripId, id));

      // Count documents
      const docResult = await this.db.select({ count: sql<number>`count(*)` })
        .from(schema.documents)
        .where(eq(schema.documents.tripId, id));

      const now = new Date().toISOString();
      await this.db.update(schema.trips)
        .set({
          photoCount: photoResult[0]?.count || 0,
          documentCount: docResult[0]?.count || 0,
          updatedAt: now,
        })
        .where(eq(schema.trips.id, id));
    },
  };

  private mapTrip(row: schema.TripRow): Trip {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description || undefined,
      coverImageUrl: row.coverImageUrl || undefined,
      startDate: row.startDate || undefined,
      endDate: row.endDate || undefined,
      defaultCenter: row.defaultCenter as Trip['defaultCenter'],
      isPublic: row.isPublic || false,
      shareSlug: row.shareSlug || undefined,
      photoCount: row.photoCount || 0,
      documentCount: row.documentCount || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ----------------------------------------
  // Canvas Operations
  // ----------------------------------------

  canvas = {
    create: async (data: CreateCanvasInput): Promise<CanvasProject> => {
      const now = new Date().toISOString();
      const id = data.id || crypto.randomUUID();

      const row = {
        id,
        userId: data.userId,
        tripId: data.tripId || null,
        title: data.title,
        viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
        elements: data.elements || [],
        isMagazineMode: data.isMagazineMode ?? true,
        pages: data.pages || null,
        currentPageIndex: data.currentPageIndex || 0,
        thumbnailUrl: data.thumbnailUrl || null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(schema.canvasProjects).values(row);

      return this.mapCanvas(row as schema.CanvasProjectRow);
    },

    findById: async (id: string): Promise<CanvasProject | null> => {
      const rows = await this.db.select().from(schema.canvasProjects).where(eq(schema.canvasProjects.id, id)).limit(1);
      const row = rows[0];
      if (!row) return null;
      return this.mapCanvas(row);
    },

    findByUserId: async (userId: string, options?: QueryOptions): Promise<CanvasProject[]> => {
      let query = this.db.select().from(schema.canvasProjects).where(eq(schema.canvasProjects.userId, userId));

      if (options?.orderBy === 'updatedAt') {
        query = query.orderBy(options.orderDirection === 'asc' ? asc(schema.canvasProjects.updatedAt) : desc(schema.canvasProjects.updatedAt)) as typeof query;
      }

      const rows = await query;
      return rows.map(row => this.mapCanvas(row));
    },

    findByTripId: async (tripId: string, options?: QueryOptions): Promise<CanvasProject[]> => {
      let query = this.db.select().from(schema.canvasProjects).where(eq(schema.canvasProjects.tripId, tripId));

      if (options?.orderBy === 'updatedAt') {
        query = query.orderBy(options.orderDirection === 'asc' ? asc(schema.canvasProjects.updatedAt) : desc(schema.canvasProjects.updatedAt)) as typeof query;
      }

      const rows = await query;
      return rows.map(row => this.mapCanvas(row));
    },

    findDefault: async (userId: string): Promise<CanvasProject | null> => {
      const rows = await this.db.select().from(schema.canvasProjects)
        .where(eq(schema.canvasProjects.userId, userId))
        .orderBy(desc(schema.canvasProjects.updatedAt))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return this.mapCanvas(row);
    },

    update: async (id: string, data: UpdateCanvasInput): Promise<CanvasProject> => {
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (data.tripId !== undefined) updateData.tripId = data.tripId || null;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.viewport !== undefined) updateData.viewport = data.viewport;
      if (data.elements !== undefined) updateData.elements = data.elements;
      if (data.isMagazineMode !== undefined) updateData.isMagazineMode = data.isMagazineMode;
      if (data.pages !== undefined) updateData.pages = data.pages;
      if (data.currentPageIndex !== undefined) updateData.currentPageIndex = data.currentPageIndex;
      if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl;
      if (data.version !== undefined) updateData.version = data.version;

      await this.db.update(schema.canvasProjects).set(updateData).where(eq(schema.canvasProjects.id, id));

      const canvas = await this.canvas.findById(id);
      if (!canvas) {
        throw new DatabaseAdapterError('Canvas not found after update', 'NOT_FOUND');
      }
      return canvas;
    },

    delete: async (id: string): Promise<void> => {
      await this.db.delete(schema.canvasProjects).where(eq(schema.canvasProjects.id, id));
    },

    incrementVersion: async (id: string): Promise<number> => {
      const now = new Date().toISOString();
      await this.db.update(schema.canvasProjects)
        .set({
          version: sql`${schema.canvasProjects.version} + 1`,
          updatedAt: now
        })
        .where(eq(schema.canvasProjects.id, id));

      const canvas = await this.canvas.findById(id);
      return canvas?.version || 1;
    },
  };

  private mapCanvas(row: schema.CanvasProjectRow): CanvasProject {
    return {
      id: row.id,
      userId: row.userId,
      tripId: row.tripId || undefined,
      title: row.title,
      viewport: row.viewport as CanvasProject['viewport'],
      elements: row.elements as CanvasProject['elements'],
      isMagazineMode: row.isMagazineMode ?? true,
      pages: row.pages as CanvasProject['pages'],
      currentPageIndex: row.currentPageIndex || 0,
      thumbnailUrl: row.thumbnailUrl || undefined,
      version: row.version || 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ----------------------------------------
  // AI Magic History Operations
  // ----------------------------------------

  aiMagicHistory = {
    create: async (data: CreateAiMagicHistoryInput): Promise<AiMagicHistoryItem> => {
      const now = new Date().toISOString();
      const id = data.id || crypto.randomUUID();

      const row = {
        id,
        userId: data.userId,
        userPrompt: data.userPrompt,
        inputImageCount: data.inputImageCount,
        styleImageCount: data.styleImageCount,
        optimizedPrompt: data.optimizedPrompt,
        reasoning: data.reasoning || null,
        resultImage: data.resultImage,
        model: data.model,
        createdAt: now,
      };

      await this.db.insert(schema.aiMagicHistory).values(row);

      return {
        id: row.id,
        userId: row.userId,
        userPrompt: row.userPrompt,
        inputImageCount: row.inputImageCount,
        styleImageCount: row.styleImageCount,
        optimizedPrompt: row.optimizedPrompt,
        reasoning: row.reasoning || undefined,
        resultImage: row.resultImage,
        model: row.model,
        createdAt: row.createdAt,
      };
    },

    findById: async (id: string): Promise<AiMagicHistoryItem | null> => {
      const rows = await this.db.select().from(schema.aiMagicHistory).where(eq(schema.aiMagicHistory.id, id)).limit(1);
      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        userId: row.userId,
        userPrompt: row.userPrompt,
        inputImageCount: row.inputImageCount,
        styleImageCount: row.styleImageCount,
        optimizedPrompt: row.optimizedPrompt,
        reasoning: row.reasoning || undefined,
        resultImage: row.resultImage,
        model: row.model,
        createdAt: row.createdAt,
      };
    },

    findByUserId: async (userId: string, options?: QueryOptions): Promise<AiMagicHistoryItem[]> => {
      let query = this.db.select().from(schema.aiMagicHistory)
        .where(eq(schema.aiMagicHistory.userId, userId))
        .orderBy(desc(schema.aiMagicHistory.createdAt));

      if (options?.limit) query = query.limit(options.limit) as typeof query;

      const rows = await query;
      return rows.map(row => ({
        id: row.id,
        userId: row.userId,
        userPrompt: row.userPrompt,
        inputImageCount: row.inputImageCount,
        styleImageCount: row.styleImageCount,
        optimizedPrompt: row.optimizedPrompt,
        reasoning: row.reasoning || undefined,
        resultImage: row.resultImage,
        model: row.model,
        createdAt: row.createdAt,
      }));
    },

    delete: async (id: string): Promise<void> => {
      await this.db.delete(schema.aiMagicHistory).where(eq(schema.aiMagicHistory.id, id));
    },

    deleteByUserId: async (userId: string): Promise<void> => {
      await this.db.delete(schema.aiMagicHistory).where(eq(schema.aiMagicHistory.userId, userId));
    },

    count: async (userId: string): Promise<number> => {
      const result = await this.db.select({ count: sql<number>`count(*)` })
        .from(schema.aiMagicHistory)
        .where(eq(schema.aiMagicHistory.userId, userId));
      return result[0]?.count || 0;
    },

    deleteOldest: async (userId: string, keepCount: number): Promise<void> => {
      const rows = await this.db.select({ id: schema.aiMagicHistory.id })
        .from(schema.aiMagicHistory)
        .where(eq(schema.aiMagicHistory.userId, userId))
        .orderBy(asc(schema.aiMagicHistory.createdAt));

      const toDelete = rows.slice(0, -keepCount);
      if (toDelete.length === 0) return;

      await this.db.delete(schema.aiMagicHistory)
        .where(inArray(schema.aiMagicHistory.id, toDelete.map(r => r.id)));
    },
  };

  // ----------------------------------------
  // Photo Embeddings Operations
  // ----------------------------------------

  photoEmbeddings = {
    upsert: async (data: CreatePhotoEmbeddingInput): Promise<PhotoEmbedding> => {
      const now = new Date().toISOString();

      // Check if exists
      const existing = await this.db.select().from(schema.photoEmbeddings)
        .where(eq(schema.photoEmbeddings.photoId, data.photoId)).limit(1);

      if (existing[0]) {
        // Update
        await this.db.update(schema.photoEmbeddings)
          .set({
            vector: data.vector,
            dimension: data.dimension,
            createdAt: now,
          })
          .where(eq(schema.photoEmbeddings.photoId, data.photoId));
      } else {
        // Insert
        await this.db.insert(schema.photoEmbeddings).values({
          photoId: data.photoId,
          userId: data.userId,
          vector: data.vector,
          dimension: data.dimension,
          createdAt: now,
        });
      }

      return {
        photoId: data.photoId,
        userId: data.userId,
        vector: data.vector,
        dimension: data.dimension,
        createdAt: now,
      };
    },

    findByUserId: async (userId: string): Promise<PhotoEmbedding[]> => {
      const rows = await this.db.select().from(schema.photoEmbeddings)
        .where(eq(schema.photoEmbeddings.userId, userId));

      return rows.map(row => ({
        photoId: row.photoId,
        userId: row.userId,
        vector: row.vector as number[],
        dimension: row.dimension,
        createdAt: row.createdAt,
      }));
    },

    findByPhotoId: async (photoId: string): Promise<PhotoEmbedding | null> => {
      const rows = await this.db.select().from(schema.photoEmbeddings)
        .where(eq(schema.photoEmbeddings.photoId, photoId)).limit(1);
      const row = rows[0];
      if (!row) return null;

      return {
        photoId: row.photoId,
        userId: row.userId,
        vector: row.vector as number[],
        dimension: row.dimension,
        createdAt: row.createdAt,
      };
    },

    delete: async (photoId: string): Promise<void> => {
      await this.db.delete(schema.photoEmbeddings).where(eq(schema.photoEmbeddings.photoId, photoId));
    },
  };

  // ----------------------------------------
  // Photo AI Metadata Operations
  // ----------------------------------------

  photoAiMetadata = {
    create: async (data: PhotoAiMetadataInput): Promise<schema.PhotoAiMetadataRow> => {
      const now = new Date().toISOString();
      const id = data.id || crypto.randomUUID();

      const row = {
        id,
        photoId: data.photoId,
        userId: data.userId,
        tags: data.tags,
        description: data.description,
        status: data.status || 'pending',
        model: data.model || null,
        errorMessage: data.errorMessage || null,
        processedAt: data.processedAt || null,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(schema.photoAiMetadata).values(row);

      return row as schema.PhotoAiMetadataRow;
    },

    findByPhotoId: async (photoId: string): Promise<schema.PhotoAiMetadataRow | null> => {
      const rows = await this.db.select().from(schema.photoAiMetadata)
        .where(eq(schema.photoAiMetadata.photoId, photoId))
        .limit(1);
      return rows[0] || null;
    },

    findByUserId: async (userId: string): Promise<schema.PhotoAiMetadataRow[]> => {
      const rows = await this.db.select().from(schema.photoAiMetadata)
        .where(eq(schema.photoAiMetadata.userId, userId))
        .orderBy(desc(schema.photoAiMetadata.createdAt));
      return rows;
    },

    findByStatus: async (userId: string, status: string, limit?: number): Promise<schema.PhotoAiMetadataRow[]> => {
      let query = this.db.select().from(schema.photoAiMetadata)
        .where(and(
          eq(schema.photoAiMetadata.userId, userId),
          eq(schema.photoAiMetadata.status, status)
        ))
        .orderBy(asc(schema.photoAiMetadata.createdAt));

      if (limit) {
        query = query.limit(limit) as typeof query;
      }

      return await query;
    },

    update: async (id: string, data: Partial<PhotoAiMetadataInput>): Promise<schema.PhotoAiMetadataRow> => {
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.model !== undefined) updateData.model = data.model;
      if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
      if (data.processedAt !== undefined) updateData.processedAt = data.processedAt;

      await this.db.update(schema.photoAiMetadata)
        .set(updateData)
        .where(eq(schema.photoAiMetadata.id, id));

      const rows = await this.db.select().from(schema.photoAiMetadata)
        .where(eq(schema.photoAiMetadata.id, id))
        .limit(1);

      if (!rows[0]) {
        throw new DatabaseAdapterError('Photo AI metadata not found after update', 'NOT_FOUND');
      }
      return rows[0];
    },

    search: async (options: PhotoAiMetadataSearchOptions): Promise<{ photoIds: string[]; total: number }> => {
      const conditions = [eq(schema.photoAiMetadata.userId, options.userId)];

      // Filter by status
      if (options.status) {
        conditions.push(eq(schema.photoAiMetadata.status, options.status));
      }

      // Filter by description query
      if (options.query) {
        conditions.push(like(schema.photoAiMetadata.description, `%${options.query}%`));
      }

      // Build base query for counting
      const countResult = await this.db.select({ count: sql<number>`count(*)` })
        .from(schema.photoAiMetadata)
        .where(and(...conditions));

      let total = countResult[0]?.count || 0;

      // Build main query
      let query = this.db.select({ photoId: schema.photoAiMetadata.photoId, tags: schema.photoAiMetadata.tags })
        .from(schema.photoAiMetadata)
        .where(and(...conditions))
        .orderBy(desc(schema.photoAiMetadata.createdAt));

      if (options.limit) {
        query = query.limit(options.limit) as typeof query;
      }
      if (options.offset) {
        query = query.offset(options.offset) as typeof query;
      }

      const rows = await query;

      // Filter by tag dimensions in application layer (SQLite JSON handling)
      let filteredRows = rows;
      if (options.tagFilters && options.tagFilters.length > 0) {
        filteredRows = rows.filter(row => {
          const tags = row.tags as Record<string, string[]>;
          return options.tagFilters!.every(filter => {
            const dimensionTags = tags[filter.dimension] || [];
            return filter.values.some(v => dimensionTags.includes(v));
          });
        });
        total = filteredRows.length;
      }

      return {
        photoIds: filteredRows.map(row => row.photoId),
        total,
      };
    },

    getStats: async (userId: string): Promise<PhotoAiMetadataStats> => {
      const statuses = ['pending', 'processing', 'completed', 'failed'] as const;
      const stats: PhotoAiMetadataStats = {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      for (const status of statuses) {
        const result = await this.db.select({ count: sql<number>`count(*)` })
          .from(schema.photoAiMetadata)
          .where(and(
            eq(schema.photoAiMetadata.userId, userId),
            eq(schema.photoAiMetadata.status, status)
          ));
        const count = result[0]?.count || 0;
        stats[status] = count;
        stats.total += count;
      }

      return stats;
    },

    delete: async (id: string): Promise<void> => {
      await this.db.delete(schema.photoAiMetadata).where(eq(schema.photoAiMetadata.id, id));
    },

    deleteByPhotoId: async (photoId: string): Promise<void> => {
      await this.db.delete(schema.photoAiMetadata).where(eq(schema.photoAiMetadata.photoId, photoId));
    },
  };

  /**
   * Close database connection
   */
  close(): void {
    this.client.close();
  }
}
