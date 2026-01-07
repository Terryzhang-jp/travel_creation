/**
 * Initialize Local SQLite Database
 *
 * Run this script to set up the local database:
 * npx tsx scripts/init-local-db.ts
 */

import { DrizzleSqliteAdapter } from '../lib/adapters/database/drizzle/sqlite-adapter';

async function main() {
  console.log('Initializing local SQLite database...\n');

  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/app.db';
  console.log(`Database path: ${dbPath}`);

  const adapter = new DrizzleSqliteAdapter({ connectionString: `file:${dbPath}` });

  try {
    await adapter.initialize();
    console.log('\n✅ Database initialized successfully!');
    console.log('\nApplication tables:');
    console.log('  - documents');
    console.log('  - photos');
    console.log('  - locations');
    console.log('  - trips');
    console.log('  - canvas_projects');
    console.log('  - ai_magic_history');
    console.log('  - photo_embeddings');
    console.log('\nBetter Auth tables:');
    console.log('  - user (manages authentication)');
    console.log('  - session');
    console.log('  - account');
    console.log('  - verification');
    console.log('\nYou can now start the application with:');
    console.log('  pnpm dev');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  } finally {
    adapter.close();
  }
}

main();
