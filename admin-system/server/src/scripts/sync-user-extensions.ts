import { db } from '../config/database';
import { userExtensions } from '../db/user-extensions-schema';
import { sql } from 'drizzle-orm';

async function syncUserExtensions() {
    console.log('Starting user extensions sync...');

    try {
        // 1. Get all users from main table
        const usersResult = await db.execute(sql`SELECT id FROM users`);
        const users = usersResult as { id: string }[];

        console.log(`Found ${users.length} users.`);

        let createdCount = 0;

        for (const user of users) {
            // 2. Check if extension exists
            const existing = await db.execute(sql`
        SELECT id FROM user_extensions WHERE user_id = ${user.id}
      `);

            if ((existing as any[]).length === 0) {
                // 3. Create default extension
                await db.insert(userExtensions).values({
                    userId: user.id,
                    currentPlan: 'free',
                    monthlyTokenLimit: 0,
                    monthlyApiCallsLimit: 0,
                    monthlyStorageLimit: 1024,
                    features: {},
                });
                createdCount++;
            }
        }

        console.log(`Sync complete. Created ${createdCount} new user extension records.`);
    } catch (error) {
        console.error('Error syncing user extensions:', error);
    } finally {
        process.exit(0);
    }
}

syncUserExtensions();
