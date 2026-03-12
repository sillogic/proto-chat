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

    // Display order for frontend
    displayOrder: integer('display_order').default(0).notNull(),

    features: jsonb('features').default({}).notNull(),

    id: text('id').primaryKey(),

    isActive: boolean('is_active').default(true),

    // Popular plan badge
    isPopular: boolean('is_popular').default(false).notNull(),

    // Monthly price in cents (e.g. 14900 for ¥149.00)
    monthlyPrice: integer('monthly_price').notNull(),

    name: text('name').notNull(),

    slug: text('slug').notNull().unique(),

    type: planTypeEnum('type').default('individual').notNull(),

    // Yearly price in cents (NULL = not available for yearly billing)
    yearlyPrice: integer('yearly_price'),

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

    // Image output token pricing (for image generation models, e.g. Gemini Nano Banana)
    // Sourced from OpenRouter /api/v1/models/{id}/endpoints → image_output field
    // Cost price: USD/token × 1_000_000 × 500_000 (credits/M tokens)
    imageOutputPrice: numeric('image_output_price', { precision: 15, scale: 6 }).default('0').notNull(),
    // User price = imageOutputPrice × multiplier
    userImageOutputPrice: numeric('user_image_output_price', { precision: 15, scale: 6 }).default('0').notNull(),

    // Cache read pricing (for models supporting prompt caching)
    // NULL/0 means no cache support; a value means cached tokens are billed at this cheaper rate
    cacheReadPrice: numeric('cache_read_price', { precision: 15, scale: 6 }).default('0').notNull(),
    // User price = cacheReadPrice × multiplier
    userCacheReadPrice: numeric('user_cache_read_price', { precision: 15, scale: 6 }).default('0').notNull(),

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
