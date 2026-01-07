/**
 * Drizzle ORM Schema Definition
 *
 * Defines database tables for SQLite.
 * This schema mirrors the Supabase database structure.
 */

import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

// ============================================
// Users Table
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  requirePasswordChange: integer('require_password_change', { mode: 'boolean' }).default(false),
  securityQuestion: text('security_question'),
  securityAnswerHash: text('security_answer_hash'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================
// Documents Table
// ============================================

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tripId: text('trip_id'),
  title: text('title').notNull(),
  content: text('content', { mode: 'json' }).$type<Record<string, unknown>>(),
  images: text('images', { mode: 'json' }).$type<string[]>().default([]),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  preview: text('preview'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================
// Photos Table
// ============================================

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tripId: text('trip_id'),
  fileName: text('file_name').notNull(),
  originalName: text('original_name').notNull(),
  fileUrl: text('file_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  locationId: text('location_id'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  category: text('category').notNull(),
  title: text('title'),
  description: text('description', { mode: 'json' }).$type<Record<string, unknown>>(),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  trashed: integer('trashed', { mode: 'boolean' }).default(false),
  trashedAt: text('trashed_at'),
  originalFileUrl: text('original_file_url'),
  edited: integer('edited', { mode: 'boolean' }).default(false),
  editedAt: text('edited_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================
// Locations Table
// ============================================

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  coordinates: text('coordinates', { mode: 'json' }).$type<{ latitude: number; longitude: number }>().notNull(),
  address: text('address', { mode: 'json' }).$type<Record<string, unknown>>(),
  placeId: text('place_id'),
  category: text('category'),
  notes: text('notes'),
  usageCount: integer('usage_count').default(0),
  lastUsedAt: text('last_used_at'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================
// Trips Table
// ============================================

export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  defaultCenter: text('default_center', { mode: 'json' }).$type<{ latitude: number; longitude: number }>(),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  shareSlug: text('share_slug').unique(),
  photoCount: integer('photo_count').default(0),
  documentCount: integer('document_count').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================
// Canvas Projects Table
// ============================================

export const canvasProjects = sqliteTable('canvas_projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  viewport: text('viewport', { mode: 'json' }).$type<{ x: number; y: number; zoom: number }>(),
  elements: text('elements', { mode: 'json' }).$type<unknown[]>().default([]),
  isMagazineMode: integer('is_magazine_mode', { mode: 'boolean' }).default(true),
  pages: text('pages', { mode: 'json' }).$type<unknown[]>(),
  currentPageIndex: integer('current_page_index').default(0),
  thumbnailUrl: text('thumbnail_url'),
  version: integer('version').default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================
// AI Magic History Table
// ============================================

export const aiMagicHistory = sqliteTable('ai_magic_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userPrompt: text('user_prompt').notNull(),
  inputImageCount: integer('input_image_count').notNull(),
  styleImageCount: integer('style_image_count').notNull(),
  optimizedPrompt: text('optimized_prompt').notNull(),
  reasoning: text('reasoning'),
  resultImage: text('result_image').notNull(),
  model: text('model').notNull(),
  createdAt: text('created_at').notNull(),
});

// ============================================
// Photo Embeddings Table
// ============================================

export const photoEmbeddings = sqliteTable('photo_embeddings', {
  photoId: text('photo_id').primaryKey().references(() => photos.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vector: text('vector', { mode: 'json' }).$type<number[]>().notNull(),
  dimension: integer('dimension').notNull(),
  createdAt: text('created_at').notNull(),
});

// ============================================
// Type exports for inference
// ============================================

export type UserRow = typeof users.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type PhotoRow = typeof photos.$inferSelect;
export type LocationRow = typeof locations.$inferSelect;
export type TripRow = typeof trips.$inferSelect;
export type CanvasProjectRow = typeof canvasProjects.$inferSelect;
export type AiMagicHistoryRow = typeof aiMagicHistory.$inferSelect;
export type PhotoEmbeddingRow = typeof photoEmbeddings.$inferSelect;
