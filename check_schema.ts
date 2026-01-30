import * as dotenv from 'dotenv';
import { db } from './admin-system/server/src/config/database';
import { sql } from 'drizzle-orm';

dotenv.config();

async function checkSchema() {
    try {
        // @ts-expect-error - pnpm duplicate drizzle-orm packages, runtime works fine
        const columns = await db.execute(sql`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'model_pricings'
      ORDER BY ordinal_position
    `);
        console.log('Columns in model_pricings:');
        console.log(JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        process.exit(0);
    }
}

checkSchema();
