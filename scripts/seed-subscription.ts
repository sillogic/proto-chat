import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { subscriptionPlans } from '../packages/database/src/schemas/subscription';

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

        const plans = [
            {
                id: 'plan_free',
                name: 'Free',
                slug: 'free',
                type: 'individual' as const,
                monthlyPrice: 0,
                yearlyPrice: null,
                currency: 'CNY',
                credits: '1000000', // 1M credits per month
                storageLimit: 512, // 512 MB
                vectorLimit: 50, // 50 chunks
                displayOrder: 0,
                isPopular: false,
                features: {
                    display: {
                        description: '适合新用户体验',
                        support_level: 'community',
                        model_estimates: [
                            { model: 'GPT-4o mini', count: '约 500 条' },
                            { model: 'Claude 3.5 Sonnet', count: '约 100 条' },
                        ],
                        vector_storage_display: '≈ 5MB',
                    },
                    capabilities: {
                        custom_api: false,
                        unlimited_messages: false,
                        unlimited_history: false,
                        global_sync: true,
                        agent_market: true,
                        premium_plugins: false,
                        web_search: false,
                        file_upload: true,
                        tts: false,
                    },
                },
                isActive: true,
            },
            {
                name: 'Lite',
                slug: 'lite',
                type: 'individual' as const,
                monthlyPrice: 14900, // ¥149.00
                yearlyPrice: 143040, // ¥1430.40 (20% off)
                currency: 'CNY',
                credits: '30000000', // 30M credits per month
                storageLimit: 5120, // 5 GB
                vectorLimit: 1000, // 1000 chunks
                displayOrder: 1,
                isPopular: false,
                features: {
                    display: {
                        description: '适合个人轻度使用',
                        support_level: 'priority_email',
                        model_estimates: [
                            { model: 'GPT-4o mini', count: '约 7,000 条' },
                            { model: 'Claude 3.5 Sonnet', count: '约 2,000 条' },
                            { model: 'GPT-4o', count: '约 250 条' },
                        ],
                        vector_storage_display: '≈ 50MB',
                    },
                    capabilities: {
                        custom_api: true,
                        unlimited_messages: false,
                        unlimited_history: true,
                        global_sync: true,
                        agent_market: true,
                        premium_plugins: true,
                        web_search: true,
                        file_upload: true,
                        tts: true,
                    },
                },
                isActive: true,
            },
            {
                name: 'Pro',
                slug: 'pro',
                type: 'individual' as const,
                monthlyPrice: 29900, // ¥299.00
                yearlyPrice: 287040, // ¥2870.40 (20% off)
                currency: 'CNY',
                credits: '100000000', // 100M credits per month
                storageLimit: 20480, // 20 GB
                vectorLimit: 5000, // 5000 chunks
                displayOrder: 2,
                isPopular: true,
                features: {
                    display: {
                        description: '适合专业用户和中度使用',
                        support_level: 'priority_email',
                        model_estimates: [
                            { model: 'GPT-4o mini', count: '约 25,000 条' },
                            { model: 'Claude 3.5 Sonnet', count: '约 6,500 条' },
                            { model: 'GPT-4o', count: '约 850 条' },
                            { model: 'Claude Opus 4', count: '约 200 条' },
                        ],
                        vector_storage_display: '≈ 250MB',
                    },
                    capabilities: {
                        custom_api: true,
                        unlimited_messages: false,
                        unlimited_history: true,
                        global_sync: true,
                        agent_market: true,
                        premium_plugins: true,
                        web_search: true,
                        file_upload: true,
                        tts: true,
                    },
                },
                isActive: true,
            },
            {
                name: 'Enterprise',
                slug: 'enterprise',
                type: 'team' as const,
                monthlyPrice: 99900, // ¥999.00
                yearlyPrice: 959040, // ¥9590.40 (20% off)
                currency: 'CNY',
                credits: '500000000', // 500M credits per month
                storageLimit: 102400, // 100 GB
                vectorLimit: 50000, // 50000 chunks
                displayOrder: 3,
                isPopular: false,
                features: {
                    display: {
                        description: '适合团队和重度使用',
                        support_level: 'dedicated',
                        model_estimates: [
                            { model: 'GPT-4o mini', count: '约 125,000 条' },
                            { model: 'Claude 3.5 Sonnet', count: '约 32,000 条' },
                            { model: 'GPT-4o', count: '约 4,250 条' },
                            { model: 'Claude Opus 4', count: '约 1,000 条' },
                        ],
                        vector_storage_display: '≈ 2.5GB',
                    },
                    capabilities: {
                        custom_api: true,
                        unlimited_messages: true,
                        unlimited_history: true,
                        global_sync: true,
                        agent_market: true,
                        premium_plugins: true,
                        web_search: true,
                        file_upload: true,
                        tts: true,
                    },
                },
                isActive: true,
            },
        ];

        for (const plan of plans) {
            await db.insert(subscriptionPlans).values(plan).onConflictDoNothing();
            console.log(`✅ ${plan.name} Plan inserted successfully.`);
        }

        console.log('✅ All subscription plans seeded successfully.');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await client.end();
    }
};

runSeed();
