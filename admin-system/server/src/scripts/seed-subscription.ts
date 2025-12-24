import { db } from '../config/database';
import { sql } from 'drizzle-orm';


const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

async function seed() {
    console.log('🌱 Seeding Subscription Plans & Model Pricing...');

    // 1. Seed Plans
    const plans = [
        {
            credits: '500000',
            currency: 'CNY',
            features: JSON.stringify({}),
            id: 'plan_free',
            interval: 'month',
            isActive: true,
            name: 'Free Trial',
            price: 0,
            slug: 'free',
            storageLimit: 1024,
            type: 'individual',
            vectorLimit: 1000
        },
        {

            credits: '5000000',

            // 69.00 CNY
            currency: 'CNY',

            features: JSON.stringify({ advanced_models: true }),

            id: 'plan_lite_mo',

            interval: 'month',
            isActive: true,
            name: 'Lite (Monthly)',
            price: 6900,
            slug: 'lite-monthly',
            storageLimit: 1024,
            type: 'individual',
            vectorLimit: 5000
        },
        {

            credits: '5000000',

            // ~58/mo
            currency: 'CNY',

            // Monthly recurring (total 60M) or just grant one?
            // Usually, subscription credits are granted MONTHLY.
            // Our system grants them at update for now.
            features: JSON.stringify({ advanced_models: true }),




            id: 'plan_lite_yr',




            interval: 'year',



            isActive: true,



            name: 'Lite (Yearly)',



            price: 69_900,


            slug: 'lite-yearly',
            storageLimit: 1024,
            type: 'individual',
            vectorLimit: 5000
        },
        {
            credits: '15000000',
            currency: 'CNY',
            features: JSON.stringify({ advanced_models: true, faster_tps: true }),
            id: 'plan_pro_mo',
            interval: 'month',
            isActive: true,
            name: 'Pro (Monthly)',
            price: 13_900,
            slug: 'pro-monthly',
            storageLimit: 2048,
            type: 'individual',
            vectorLimit: 10_000
        },
        {
            credits: '35000000',
            currency: 'CNY',
            features: JSON.stringify({ all_features: true }),
            id: 'plan_ultra_mo',
            interval: 'month',
            isActive: true,
            name: 'Ultra (Monthly)',
            price: 27_900,
            slug: 'ultra-monthly',
            storageLimit: 4096,
            type: 'individual',
            vectorLimit: 20_000
        }
    ];

    for (const plan of plans) {
        await db.execute(sql.raw(`
            INSERT INTO subscription_plans (id, name, slug, type, price, currency, interval, credits, features, storage_limit, vector_limit, is_active, updated_at, created_at)
            VALUES ('${plan.id}', '${plan.name}', '${plan.slug}', '${plan.type}', ${plan.price}, '${plan.currency}', '${plan.interval}', ${plan.credits}, '${plan.features}'::jsonb, ${plan.storageLimit}, ${plan.vectorLimit}, ${plan.isActive}, now(), now())
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                price = EXCLUDED.price,
                credits = EXCLUDED.credits,
                features = EXCLUDED.features,
                storage_limit = EXCLUDED.storage_limit,
                vector_limit = EXCLUDED.vector_limit
        `));
    }

    // 2. Seed Model Pricing (Sample Standard with Markup)
    // Scale: Credits per 1,000,000 tokens
    const models = [
        { input: 500, model: 'gpt-4o-mini', output: 2000, provider: 'openai' },
        { input: 15e3, model: 'gpt-4o', output: 45e3, provider: 'openai' },
        { input: 500, model: 'gpt-5-mini', output: 2000, provider: 'openai' },
        { input: 10e3, model: 'claude-3-5-sonnet', output: 45e3, provider: 'anthropic' },
        { input: 800, model: 'claude-3-haiku', output: 4000, provider: 'anthropic' },
        { input: 0, model: 'glm-4-mini', output: 0, provider: 'zhipu' },
        { input: 1000, model: 'glm-4', output: 3000, provider: 'zhipu' },
        { input: 1500, model: 'glm-4.6', output: 3500, provider: 'zhipu' }
    ];

    for (const m of models) {
        const id = generateId('mp');
        await db.execute(sql.raw(`
            INSERT INTO model_pricings (id, model, provider, input_price, output_price, per_request_price, updated_at, created_at)
            VALUES ('${id}', '${m.model}', '${m.provider}', ${m.input}, ${m.output}, 0, now(), now())
            ON CONFLICT (model, provider) DO NOTHING
        `));
    }

    console.log('✅ Seeding completed!');
}

seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
