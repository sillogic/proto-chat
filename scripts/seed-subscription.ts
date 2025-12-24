import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { subscriptionPlans, planIntervalEnum, planTypeEnum } from '../packages/database/src/schemas/subscription';

dotenv.config();

const runSeed = async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }

    const client = new Client({ connectionString });
    await client.connect();
    const db = drizzle(client);

    try {
        console.log('🌱 Seeding Subscription Plans...');

        const litePlan = {
            name: 'Lite Monthly',
            slug: 'lite-monthly',
            type: 'individual' as const,
            price: 990, // 9.90
            currency: 'CNY',
            interval: 'month' as const,
            credits: '5000000', // 5M credits
            features: {
                description: 'Starter plan for individuals',
                models: ['gpt-4o-mini', 'claude-3-sonnet'],
            },
            isActive: true,
        };

        await db.insert(subscriptionPlans).values(litePlan).onConflictDoNothing();

        console.log('✅ Lite Plan inserted successfully.');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await client.end();
    }
};

runSeed();
