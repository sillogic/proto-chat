import { db } from '../config/database';
import { subscriptionPlans } from '../db/subscription-schema';
import { userTransactions } from '../db/credit-schema';
import { eq, sql } from 'drizzle-orm';

async function batchSubscribe() {
    console.log('🚀 Starting batch subscription of all users to Lite (Monthly)...');

    // 1. Get the Lite Monthly plan
    const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, 'lite-monthly')).limit(1);

    if (!plan || plan.length === 0) {
        console.error('❌ Lite Monthly plan not found. Please run seed-subscription first.');
        return;
    }

    const litePlan = plan[0] as any;
    const creditsToGrant = litePlan.credits; // '5000000.00'
    const storageToSet = litePlan.storageLimit;
    const vectorsToSet = litePlan.vectorLimit;

    // 2. Get all user IDs from user_extensions or users table
    // For safety, let's get from users table (or just update existing extensions)
    const usersResult = await db.execute(sql`SELECT id FROM users`);
    const userIds = (usersResult as any[]).map(u => u.id);

    console.log(`📊 Found ${userIds.length} users to process.`);

    for (const userId of userIds) {
        try {
            // Update extension
            await db.execute(sql`
              INSERT INTO user_extensions (user_id, current_plan, monthly_storage_limit, monthly_vector_limit, monthly_token_limit, updated_at)
              VALUES (${userId}, 'lite-monthly', ${storageToSet}, ${vectorsToSet}, ${parseInt(creditsToGrant)}, now())
              ON CONFLICT (user_id) DO UPDATE SET
              current_plan = 'lite-monthly',
              monthly_storage_limit = ${storageToSet},
              monthly_vector_limit = ${vectorsToSet},
              monthly_token_limit = ${parseInt(creditsToGrant)},
              updated_at = now()
            `);

            // Update balance
            await db.execute(sql`
              INSERT INTO user_balances (user_id, balance, updated_at)
              VALUES (${userId}, ${creditsToGrant}, now())
              ON CONFLICT (user_id) DO UPDATE SET
              balance = user_balances.balance::numeric + ${creditsToGrant}::numeric,
              updated_at = now()
            `);

            // Record Transaction
            const txId = 'tx_batch_' + Math.random().toString(36).slice(2, 12);
            await db.insert(userTransactions).values({
                amount: creditsToGrant,
                category: 'TEST_BATCH_SUB',
                createdAt: new Date(),
                description: `Batch Subscription for Testing: ${litePlan.name}`,
                id: txId,
                type: 'SUBSCRIPTION_GRANT',
                updatedAt: new Date(),
                userId,
            } as any);

            console.log(`✅ Processed user: ${userId}`);
        } catch (err) {
            console.error(`❌ Failed to process user ${userId}:`, err);
        }
    }

    console.log('🏁 Batch subscription completed!');
}

batchSubscribe().catch(err => {
    console.error('❌ Batch script failed:', err);
    process.exit(1);
});
