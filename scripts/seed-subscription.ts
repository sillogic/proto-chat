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
                credits: '350000', // 350,000 积分/月
                storageLimit: 512, // 0.5 GB
                vectorLimit: 1000, // 1,000 条
                displayOrder: 0,
                isPopular: false,
                features: {
                    display: {
                        description: '适合新用户体验',
                        model_estimates: [
                            { model: 'GPT-5 mini', count: '约 500 条' },
                            { model: 'DeepSeek V3.2', count: '约 140 条' },
                        ],
                    },
                    resources: {
                        credits_per_month: '350,000',
                        file_storage_gb: '0.5',
                        vector_storage: '1,000 条',
                        vector_storage_display: '≈ 10MB',
                    },
                    cloud_services: {
                        unlimited_history: false,
                        global_sync: true,
                        web_search: false,
                    },
                    support: {
                        level: '社区论坛',
                    },
                    capabilities: {
                        custom_api: false,
                        unlimited_messages: false,
                    },
                },
                isActive: true,
            },
            {
                name: 'Lite',
                slug: 'lite',
                type: 'individual' as const,
                monthlyPrice: 14900, // ¥149/月
                yearlyPrice: 142800, // ¥1428/年（年付月价 ¥119 × 12）
                currency: 'CNY',
                credits: '5000000', // 5,000,000 积分/月
                storageLimit: 1024, // 1.0 GB
                vectorLimit: 5000, // 5,000 条
                displayOrder: 10,
                isPopular: false,
                features: {
                    display: {
                        description: '适合轻度使用 AI 的用户',
                        model_estimates: [
                            { model: 'GPT-5 mini', count: '约 7,000 条' },
                            { model: 'DeepSeek V3.2', count: '约 1,900 条' },
                        ],
                    },
                    resources: {
                        credits_per_month: '5,000,000',
                        file_storage_gb: '1.0',
                        vector_storage: '5,000 条',
                        vector_storage_display: '≈ 50MB',
                    },
                    cloud_services: {
                        unlimited_history: true,
                        global_sync: true,
                        web_search: true,
                    },
                    support: {
                        level: '邮件和社区论坛',
                    },
                    capabilities: {
                        custom_api: true,
                        unlimited_messages: true,
                    },
                },
                isActive: true,
            },
            {
                name: 'Pro',
                slug: 'pro',
                type: 'individual' as const,
                monthlyPrice: 29900, // ¥299/月
                yearlyPrice: 286800, // ¥2868/年（年付月价 ¥239 × 12）
                currency: 'CNY',
                credits: '15000000', // 15,000,000 积分/月
                storageLimit: 2048, // 2.0 GB
                vectorLimit: 10000, // 10,000 条
                displayOrder: 20,
                isPopular: true, // 最多选择标签
                features: {
                    display: {
                        description: '为频繁使用 AI 的专业用户设计',
                        model_estimates: [
                            { model: 'GPT-5 mini', count: '约 21,100 条' },
                            { model: 'DeepSeek V3.2', count: '约 5,800 条' },
                        ],
                    },
                    resources: {
                        credits_per_month: '15,000,000',
                        file_storage_gb: '2.0',
                        vector_storage: '10,000 条',
                        vector_storage_display: '≈ 100MB',
                    },
                    cloud_services: {
                        unlimited_history: true,
                        global_sync: true,
                        web_search: true,
                    },
                    support: {
                        level: '优先邮件支持',
                    },
                    capabilities: {
                        custom_api: true,
                        unlimited_messages: true,
                    },
                },
                isActive: true,
            },
            {
                name: 'Ultra',
                slug: 'ultra',
                type: 'individual' as const,
                monthlyPrice: 59900, // ¥599/月
                yearlyPrice: 574800, // ¥5748/年（年付月价 ¥479 × 12）
                currency: 'CNY',
                credits: '35000000', // 35,000,000 积分/月
                storageLimit: 4096, // 4.0 GB
                vectorLimit: 20000, // 20,000 条
                displayOrder: 30,
                isPopular: false,
                features: {
                    display: {
                        description: '针对需要更高 AI 复杂对话的重度用户',
                        model_estimates: [
                            { model: 'GPT-5 mini', count: '约 49,100 条' },
                            { model: 'DeepSeek V3.2', count: '约 13,400 条' },
                        ],
                    },
                    resources: {
                        credits_per_month: '35,000,000',
                        file_storage_gb: '4.0',
                        vector_storage: '20,000 条',
                        vector_storage_display: '≈ 200MB',
                    },
                    cloud_services: {
                        unlimited_history: true,
                        global_sync: true,
                        web_search: true,
                    },
                    support: {
                        level: '优先邮件和即时支持',
                    },
                    capabilities: {
                        custom_api: true,
                        unlimited_messages: true,
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
