# Database Initialization Race Condition

## Issue Summary

**Date:** 2026-01-07
**Affected Component:** SQLite Database Adapter (Drizzle)
**Symptom:** `SqliteError: no such column: trip_id` on first request, second request succeeds

## Problem Description

When adding a new column (`trip_id`) to the `canvas_projects` table, a race condition occurred where:

1. The database adapter's `initialize()` method (which runs table creation and migrations) was called but **not awaited**
2. API requests would execute database queries before the migration completed
3. First request failed with "no such column" error
4. Second request succeeded because migration had completed in the background

### Root Cause

```typescript
// lib/adapters/database/index.ts (before fix)
case 'drizzle-sqlite': {
  const adapter = new DrizzleSqliteAdapter(resolvedConfig.drizzle);
  adapter.initialize();  // ❌ Not awaited - causes race condition
  return adapter;
}
```

The `initialize()` method is async and performs:
- Table creation (`CREATE TABLE IF NOT EXISTS ...`)
- Schema migrations (`ALTER TABLE ... ADD COLUMN ...`)
- Index creation (`CREATE INDEX IF NOT EXISTS ...`)

Without awaiting, queries could execute before these operations completed.

## Current Fix

### 1. Store Initialization Promise

```typescript
// lib/adapters/database/index.ts
let initializationPromise: Promise<void> | null = null;

case 'drizzle-sqlite': {
  const adapter = new DrizzleSqliteAdapter(resolvedConfig.drizzle);
  initializationPromise = adapter.initialize();  // Store the promise
  return adapter;
}
```

### 2. Add `ensureDatabaseReady()` Function

```typescript
export async function ensureDatabaseReady(): Promise<DatabaseAdapter> {
  const adapter = getDatabaseAdapter();
  if (initializationPromise) {
    await initializationPromise;  // Wait for initialization
  }
  return adapter;
}
```

### 3. Call in API Routes

```typescript
// Example: app/api/canvas/route.ts
export async function GET(req: Request) {
  const session = await requireAuth(req);
  await ensureDatabaseReady();  // Ensure DB is ready before queries
  const projects = await canvasStorage.findByUserId(userId);
  // ...
}
```

### Files Modified

- `lib/adapters/database/index.ts` - Added `ensureDatabaseReady()` function
- `app/api/canvas/route.ts` - Added `ensureDatabaseReady()` calls
- `app/api/canvas/[id]/route.ts` - Added `ensureDatabaseReady()` calls
- `app/api/canvas/default/route.ts` - Added `ensureDatabaseReady()` calls
- `app/api/canvas/upload-image/route.ts` - Added `ensureDatabaseReady()` calls

## Limitations of Current Fix

The current fix only applies to Canvas API routes. Other API routes (documents, photos, trips, etc.) do not call `ensureDatabaseReady()`.

**Potential Issue:** If a user's first request hits a non-Canvas API, the race condition could still occur.

## Recommended Long-term Solutions

### Option A: Storage Layer Integration (Recommended)

Move `ensureDatabaseReady()` into the Storage classes so all database operations automatically wait for initialization:

```typescript
// lib/storage/canvas-storage.ts
export class CanvasStorage {
  private async getDb() {
    return await ensureDatabaseReady();
  }

  async findById(id: string) {
    const db = await this.getDb();
    return db.canvas.findById(id);
  }
}
```

### Option B: Middleware Approach

Add database readiness check to Next.js middleware:

```typescript
// middleware.ts
import { ensureDatabaseReady } from '@/lib/adapters/database';

export async function middleware(req: Request) {
  if (req.url.includes('/api/')) {
    await ensureDatabaseReady();
  }
  // ...
}
```

### Option C: Lazy Initialization in Adapter

Make the adapter internally await initialization before each operation:

```typescript
class DrizzleSqliteAdapter {
  private ready: Promise<void>;

  constructor() {
    this.ready = this.initialize();
  }

  private async ensureReady() {
    await this.ready;
  }

  async findById(id: string) {
    await this.ensureReady();
    // ... actual query
  }
}
```

## Testing Notes

To verify the fix works:

1. Delete the SQLite database: `rm -rf apps/web/data/app.db`
2. Start the dev server: `pnpm dev`
3. Navigate to Canvas page
4. First request should succeed (no "no such column" error)

## Related Files

- `lib/adapters/database/drizzle/sqlite-adapter.ts` - Contains `initialize()` and `runMigrations()` methods
- `lib/adapters/database/drizzle/schema.ts` - Drizzle schema definitions
- `lib/adapters/database/types.ts` - Database adapter interfaces
