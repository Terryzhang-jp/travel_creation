# Novel Book - Travel Journal & Document Editor

A multi-user travel journal and document editing application built on the Novel editor (Notion-style WYSIWYG) with flexible database and storage adapters.

## Features

- 🔐 **User Authentication** - Better Auth with bcrypt password hashing
- 👥 **Multi-User Support** - Complete user isolation with per-user data storage
- 📝 **Rich Text Editor** - Notion-style WYSIWYG editor powered by Tiptap
- 📷 **Photo Management** - Upload, organize, and edit photos with EXIF support
- 🗺️ **Location Tracking** - Map integration with OpenStreetMap/Leaflet
- ✈️ **Trip Organization** - Group documents and photos by trips
- 🎨 **Canvas Editor** - Magazine-style visual layouts
- 🔍 **Document Search** - Real-time search across document titles, content, and tags
- 💾 **Auto-Save** - Automatic document saving with debounce
- 🔌 **Flexible Backend** - Swap between SQLite, Supabase, or S3 storage

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Editor**: Novel (Tiptap-based)
- **Auth**: Better Auth
- **Database**: SQLite (local) or Supabase (production)
- **Storage**: Local filesystem or S3-compatible
- **Styling**: Tailwind CSS
- **Monorepo**: Turborepo + pnpm

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9.5.0+

### Installation

```bash
# Clone the repository
git clone https://github.com/Terryzhang-jp/novel_book.git
cd novel_book

# Install dependencies
pnpm install

# Setup environment
cd apps/web
cp .env.example .env.local

# Generate auth secret (required)
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local

# Initialize database
npx tsx scripts/init-local-db.ts

# Start development server
cd ../..
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### First Time Setup

1. Visit `http://localhost:3000`
2. Click "Sign up" to create an account
3. Enter your email, password (min 6 characters), and optional name
4. You'll be automatically logged in and redirected to your documents

## Configuration

### Local Development (Default)

The default configuration uses **SQLite** for database and **local filesystem** for storage. No external services required!

```env
DATABASE_ADAPTER=drizzle-sqlite
DATABASE_URL=file:./data/app.db
STORAGE_ADAPTER=local
```

### Production (Supabase)

For production deployment with Supabase:

```env
DATABASE_ADAPTER=supabase
STORAGE_ADAPTER=supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### AI Features (Optional)

Add OpenAI API key for AI writing assistance:

```env
OPENAI_API_KEY=sk-your-api-key
```

## Project Structure

```
novel_book/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/                # App router pages & API routes
│       ├── lib/
│       │   ├── adapters/       # Database & storage adapters
│       │   │   ├── database/   # SQLite, Supabase adapters
│       │   │   └── storage/    # Local, S3, Supabase storage
│       │   ├── auth/           # Better Auth configuration
│       │   └── storage/        # Business logic layer
│       ├── components/         # React components
│       └── data/               # Local SQLite & uploads (gitignored)
└── packages/
    └── headless/               # Novel editor core
```

## Development Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm typecheck        # Type checking
pnpm lint             # Lint code
pnpm format           # Format code
```

## API Endpoints

### Authentication
- `POST /api/auth/sign-up` - Register new user
- `POST /api/auth/sign-in` - Login user
- `POST /api/auth/sign-out` - Logout user

### Documents
- `GET /api/documents` - List user's documents
- `POST /api/documents` - Create new document
- `GET /api/documents/[id]` - Get document details
- `PUT /api/documents/[id]` - Update document
- `DELETE /api/documents/[id]` - Delete document

### Photos
- `GET /api/photos` - List user's photos
- `POST /api/photos/upload` - Upload photo
- `PUT /api/photos/[id]` - Update photo metadata

### Trips
- `GET /api/trips` - List user's trips
- `POST /api/trips` - Create new trip

## License

Licensed under the [Apache-2.0 license](LICENSE).

## Acknowledgments

Built on top of [Novel](https://novel.sh/) by [@steventey](https://github.com/steven-tey) - an amazing Notion-style WYSIWYG editor.

---

**Built with ❤️ using Next.js, Tiptap, and Tailwind CSS**
