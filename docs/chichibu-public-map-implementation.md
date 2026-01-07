# Chichibu Public Map - Implementation Strategy

## Goal

Create a public Chichibu travel map page (`/chichibu`) that displays photos from all users, including location, description, and uploader information.

## Requirements Confirmation

### Functional Requirements
- All users' photos are publicly visible (temporarily all public, privacy controls can be added later)
- This is a travel sharing application
- Photo descriptions/journal content are publicly displayed
- Show uploader's real name (`user.name`)
- Route: `/chichibu`
- Accessible without login

### Technical Requirements
- Map default center at Chichibu (completed)
- Reuse existing PhotoMap component
- Create new public API to return all users' photos
- JOIN user information to display uploader name
- Read-only mode (no editing features)

## Architecture Plan: Hybrid Approach (Phase 1)

### Why this approach?

**Initial (now):**
- Small number of users (<10), file scanning performance is acceptable
- Quick implementation, validate product direction
- Avoid over-engineering

**Later (when users increase):**
- Can migrate to global index
- API interface remains unchanged, only internal implementation optimization

## Data Structure Design

### 1. Extend Photo Type
```typescript
interface Photo {
  // ... existing fields
  isPublic?: boolean;  // Whether public (default true)
}
```

### 2. New PublicPhotoData Type (API response)
```typescript
interface PublicPhotoData {
  // Photo basic info
  id: string;
  userId: string;
  fileName: string;
  category: PhotoCategory;

  // Metadata
  metadata: {
    dateTime?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    camera?: {
      make?: string;
      model?: string;
    };
    fileSize?: number;
    dimensions?: { width: number; height: number };
  };

  // Description (journal content)
  description?: JSONContent;

  // Uploader info
  userName: string;  // User's real name
  userEmail?: string;  // Optional: for avatar generation

  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

## Implementation Steps

### Phase 1: Backend API (~30 minutes)

#### Step 1.1: Extend Photo Type
**File:** `apps/web/types/storage.ts`

```typescript
export interface Photo {
  // ... existing fields
  isPublic?: boolean;  // New: whether public (default true)
}
```

#### Step 1.2: Create Public Photos API
**File:** `apps/web/app/api/public/photos/route.ts` (new)

**Functionality:**
- No authentication required (public access)
- Scan `data/photos/*.json` to get all photos
- Filter: only return photos where `isPublic !== false`
- JOIN user information (from `data/auth/users.json`)
- Only return photos with location info (for map display)

**Pseudocode:**
```typescript
export async function GET(req: Request) {
  // 1. Read all photo files
  const allPhotos = scanPhotosDirectory();

  // 2. Filter: only public + with location
  const publicPhotos = allPhotos.filter(photo =>
    photo.isPublic !== false &&
    photo.metadata?.location
  );

  // 3. JOIN user information
  const users = readUsersFile();
  const photosWithUserInfo = publicPhotos.map(photo => ({
    ...photo,
    userName: users.find(u => u.id === photo.userId)?.name || 'Anonymous',
  }));

  // 4. Return data
  return NextResponse.json({ photos: photosWithUserInfo });
}
```

#### Step 1.3: Implement Photo Scanning Utility Function
**File:** `apps/web/lib/storage/photo-storage.ts`

New method:
```typescript
/**
 * Get all public photos (for public map)
 * Does not require userId, returns public photos from all users
 */
async getAllPublicPhotos(): Promise<Photo[]> {
  // Scan data/photos/ directory
  // Filter isPublic !== false
  // Return complete Photo objects
}
```

### Phase 2: Frontend Page (~45 minutes)

#### Step 2.1: Modify Middleware to Allow Public Access
**File:** `apps/web/middleware.ts`

```typescript
// Public routes (no authentication required)
const publicRoutes = ["/login", "/register", "/chichibu"];  // Add /chichibu
```

#### Step 2.2: Create Chichibu Public Page
**File:** `apps/web/app/chichibu/page.tsx` (new)

**Layout:**
```
┌─────────────────────────────────────┐
│  Hero Section                       │
│  - Title: "Chichibu Travel"         │
│  - Stats: X photos, Y travelers     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Interactive Map                    │
│  - Map center: Chichibu             │
│  - Show all public photo pins       │
│  - Click pin → open detail modal    │
└─────────────────────────────────────┘
```

**Functionality:**
- Accessible without login
- Call `GET /api/public/photos`
- Reuse `PhotoMap` component
- Click photo to open `PublicPhotoDetailModal`

#### Step 2.3: Create Public Photo Detail Modal
**File:** `apps/web/components/photos/public-photo-detail-modal.tsx` (new)

**Differences from PhotoDetailModal:**
- Show uploader info (name)
- Show full description (Novel format rendering)
- No edit functionality (read-only)
- No LocationAssignment component
- No delete button

**UI Elements:**
```
┌──────────────────────────────────────┐
│  [Close X]                           │
│                                      │
│  ┌────────────┐  ┌────────────────┐ │
│  │            │  │ Uploader: John │ │
│  │   Photo    │  │ Date: 2024-10-18│ │
│  │            │  │ Location: Chichibu│ │
│  │            │  │                │ │
│  └────────────┘  │ Description:   │ │
│                  │ (Novel render)  │ │
│                  │                │ │
│                  └────────────────┘ │
└──────────────────────────────────────┘
```

#### Step 2.4: Adjust PhotoMap Component to Support Public Data
**File:** `apps/web/components/maps/photo-map.tsx`

**Possible adjustments needed:**
- Check if props need extension (pass userName)
- Ensure popup can display user information

### Phase 3: Data Initialization (~15 minutes)

#### Step 3.1: Add Default isPublic to Existing Photos
**Strategy:**
- All existing photos default to `isPublic = true` (backward compatible)
- New uploads default to `isPublic = true`
- Can add settings interface in the future

**Modification:**
```typescript
// photo-storage.ts - create() method
const photo: Photo = {
  // ... existing fields
  isPublic: true,  // Add default value
};
```

### Phase 4: Testing (~30 minutes)

#### Test Checklist
- [ ] `/chichibu` page accessible without login
- [ ] Display all users' photo pins
- [ ] Click pin opens detail modal
- [ ] Shows correct user name
- [ ] Shows complete photo description (Novel format)
- [ ] Map default center at Chichibu
- [ ] No edit buttons (read-only mode)
- [ ] Existing user functionality unaffected (`/gallery/*` works normally)

## Technical Details

### 1. Photo Scanning Performance Optimization

**Initial (MVP):**
```typescript
// Simple scan, no cache
async getAllPublicPhotos() {
  const files = fs.readdirSync('data/photos/');
  const photos = files.map(f => readJSON(f));
  return photos.filter(p => p.isPublic !== false);
}
```

**Later optimization (optional):**
```typescript
// Add memory cache (5 minutes)
const cache = { data: null, timestamp: 0 };
async getAllPublicPhotos() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < 5 * 60 * 1000) {
    return cache.data;
  }

  const photos = scanPhotos();
  cache.data = photos;
  cache.timestamp = now;
  return photos;
}
```

### 2. User Information JOIN

```typescript
// Read user list
const users = await userStorage.readUsers();
const userMap = new Map(users.map(u => [u.id, u]));

// JOIN operation
const photosWithUserInfo = photos.map(photo => ({
  ...photo,
  userName: userMap.get(photo.userId)?.name || 'Anonymous',
}));
```

### 3. Novel Description Rendering

Reuse existing rendering logic:
```typescript
import { extractTextFromJSON, isJSONContentEmpty } from '@/lib/utils/json-content';

// Display in modal
{!isJSONContentEmpty(photo.description) && (
  <div className="prose prose-sm">
    {/* Use Novel's read-only renderer */}
    <EditorContent
      initialContent={photo.description}
      editable={false}
    />
  </div>
)}
```

## Potential Issues and Solutions

### Issue 1: Performance (when users increase)
**Symptom:** When photos >1000, scanning becomes slow
**Solution:** Migrate to global index (Phase 2)

### Issue 2: Photo Path Access
**Symptom:** Public page cannot access `/images/{userId}/gallery/`
**Check:** middleware configured to allow access to `/images/*`
**Confirm:** `matcher` excludes `images` path

### Issue 3: Photos After User Account Deletion
**Symptom:** User info not found, shows "Anonymous"
**Approach:** Acceptable (soft delete strategy)

## File List

### New Files
```
apps/web/
├── app/
│   ├── chichibu/
│   │   └── page.tsx                    # Public map page
│   └── api/
│       └── public/
│           └── photos/
│               └── route.ts            # Public photos API
└── components/
    └── photos/
        └── public-photo-detail-modal.tsx  # Public photo detail modal
```

### Modified Files
```
apps/web/
├── types/
│   └── storage.ts                      # Add isPublic field
├── lib/storage/
│   └── photo-storage.ts                # Add getAllPublicPhotos()
├── middleware.ts                       # Allow /chichibu public access
└── components/maps/
    └── photo-map.tsx                   # May need small adjustments (display user info)
```

## Time Estimate

| Task | Time |
|------|------|
| Extend type definitions | 5 min |
| Implement getAllPublicPhotos() | 15 min |
| Create public API | 15 min |
| Modify middleware | 5 min |
| Create /chichibu page | 20 min |
| Create public Modal component | 25 min |
| Testing and debugging | 30 min |
| **Total** | **~2 hours** |

## Future Extensions (Phase 2 - Optional)

### 1. Privacy Controls
- Photo settings interface (public/private toggle)
- Update `PUT /api/photos/[id]` to support modifying `isPublic`

### 2. Global Index
- Create `data/indexes/public.json`
- Sync update global index when photo CRUD operations
- Optimize query performance

### 3. Social Features
- Like/favorite
- Comment system
- User profiles

### 4. UI Enhancements
- Hero section design
- Timeline filter
- User filter
- Waterfall/grid view toggle

## Start Implementation

Execute in the following order:
1. Extend Photo type (`types/storage.ts`)
2. Implement photo scanning (`photo-storage.ts`)
3. Create public API (`app/api/public/photos/route.ts`)
4. Modify middleware (`middleware.ts`)
5. Create public Modal (`components/photos/public-photo-detail-modal.tsx`)
6. Create public page (`app/chichibu/page.tsx`)
7. Test and verify

---

**Status:** Ready to start implementation
**Last Updated:** 2025-10-19
