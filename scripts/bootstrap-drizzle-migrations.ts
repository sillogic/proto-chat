/**
 * Bootstrap Drizzle migration tracking for databases that were set up manually.
 *
 * This script creates the `drizzle.__drizzle_migrations` table and populates it
 * with hashes for all migration files, marking them as already applied.
 *
 * Run once: tsx ./scripts/bootstrap-drizzle-migrations.ts
 * After this, use: bun run db:migrate (for future migrations)
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import pg from 'pg';

// Load environment variables (same order as migrateServerDB/index.ts)
const env = process.env.NODE_ENV || 'development';
dotenvExpand.expand(dotenv.config());
dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}` }));
dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}.local` }));

const migrationsFolder = join(__dirname, '../packages/database/migrations');

const bootstrap = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set. Check your .env.local file.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log('✅ Connected to database\n');

  // Read the Drizzle journal
  const journalPath = join(migrationsFolder, 'meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as {
    entries: Array<{ idx: number; tag: string; when: number }>;
  };

  // Create the drizzle schema and migrations tracking table
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  console.log('✅ Ensured drizzle.__drizzle_migrations table exists\n');

  // Get already recorded hashes
  const { rows: existing } = await client.query<{ hash: string }>(
    'SELECT hash FROM drizzle.__drizzle_migrations',
  );
  const existingHashes = new Set(existing.map((r) => r.hash));
  console.log(`   Found ${existingHashes.size} already-recorded migrations\n`);

  // Process each migration entry
  let inserted = 0;
  let skipped = 0;
  let missing = 0;

  for (const entry of journal.entries) {
    const sqlPath = join(migrationsFolder, `${entry.tag}.sql`);

    if (!existsSync(sqlPath)) {
      console.warn(`⚠️  SQL file not found, skipping: ${entry.tag}.sql`);
      missing++;
      continue;
    }

    const sql = readFileSync(sqlPath, 'utf-8');
    // Drizzle computes hash as sha256 of the raw file content
    const hash = createHash('sha256').update(sql).digest('hex');

    if (existingHashes.has(hash)) {
      console.log(`   → Already recorded: ${entry.tag}`);
      skipped++;
    } else {
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when],
      );
      console.log(`   ✓ Marked as applied:  ${entry.tag}`);
      inserted++;
    }
  }

  await client.end();

  console.log('\n─────────────────────────────────────────────');
  console.log(`✅ Bootstrap complete!`);
  console.log(`   Inserted: ${inserted} new records`);
  console.log(`   Skipped:  ${skipped} already recorded`);
  if (missing > 0) console.log(`   Missing:  ${missing} SQL files not found`);
  console.log('─────────────────────────────────────────────');
  console.log('\nYou can now use "bun run db:migrate" for all future migrations.');
  process.exit(0);
};

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err.message || err);
  process.exit(1);
});
