import * as dotenv from 'dotenv';
import { db } from './admin-system/server/src/config/database';
import { sql } from 'drizzle-orm';

dotenv.config();

async function checkMigrations() {
    try {
        const migrations = await db.execute(sql`
      SELECT id, hash, created_at 
      FROM "drizzle"."__drizzle_migrations"
      ORDER BY id ASC
    `);
        console.log('Applied migrations:');
        console.log(JSON.stringify(migrations, null, 2));
    } catch (error) {
        console.error('Error checking migrations:', error);
    } finally {
        process.exit(0);
    }
}

checkMigrations();
