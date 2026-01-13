import {
    boolean,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    numeric,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Plan interval enum
export const planIntervalEnum = pgEnum('plan_interval', ['month', 'year']);

// Plan type enum
export const planTypeEnum = pgEnum('plan_type', ['individual', 'team']);

// Timestamps helper
export const timestamps = {
    createdAt: timestamp('created_at', { mode: 'date', precision: 3 }).default(sql`now()`).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).default(sql`now()`).notNull(),
};

// Subscription Plans
export const subscriptionPlans = pgTable('subscription_plans', {
    credits: numeric('credits', { precision: 12, scale: 2 }).default('0').notNull(),
    storageLimit: integer('storage_limit').default(1024).notNull(),
    vectorLimit: integer('vector_limit').default(0).notNull(),

    currency: text('currency').default('CNY').notNull(),

    features: jsonb('features').default({}).notNull(),

    id: text('id').primaryKey(),

    interval: planIntervalEnum('interval').default('month').notNull(),

    isActive: boolean('is_active').default(true),

    name: text('name').notNull(),

    price: integer('price').notNull(),

    slug: text('slug').notNull().unique(),

    type: planTypeEnum('type').default('individual').notNull(),

    ...timestamps,
});

// Model Pricing Coefficients
export const modelPricings = pgTable('model_pricings', {
    id: text('id').primaryKey(),

    // Cost price in credits per 1,000,000 tokens (成本价)
    inputPrice: numeric('input_price', { precision: 15, scale: 6 }).default('0').notNull(),

    model: text('model').notNull(),

    // Cost price in credits per 1,000,000 tokens (成本价)
    outputPrice: numeric('output_price', { precision: 15, scale: 6 }).default('0').notNull(),

    // Price in credits per request
    perRequestPrice: numeric('per_request_price', { precision: 15, scale: 6 }).default('0').notNull(),

    // e.g. "openai", "protochat"
    provider: text('provider').notNull(),

    // Sub-provider (only for ProtoChat): e.g. "openrouter", "deepseek"
    subProvider: text('sub_provider'),

    // User price in credits per 1,000,000 tokens (用户价 = 成本价 × 系数)
    // Pre-calculated to avoid runtime computation for better performance
    userInputPrice: numeric('user_input_price', { precision: 15, scale: 6 }).default('0').notNull(),
    userOutputPrice: numeric('user_output_price', { precision: 15, scale: 6 }).default('0').notNull(),

    // Memo for admin
    memo: text('memo'),

    ...timestamps,
}, (table) => {
    return {
        // Unique constraint on (model, provider, subProvider)
        // NULL values are treated as distinct in PostgreSQL, so this works correctly
        modelProviderSubProviderIdx: uniqueIndex('model_provider_subprovider_idx').on(
            table.model,
            table.provider,
            table.subProvider
        ),
    };
});

export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type SubscriptionPlanItem = typeof subscriptionPlans.$inferSelect;
export type NewModelPricing = typeof modelPricings.$inferInsert;
export type ModelPricingItem = typeof modelPricings.$inferSelect;
