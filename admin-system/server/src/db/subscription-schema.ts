import {
    boolean,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    numeric
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

    // We will let app generate ID or DB default if function exists
    name: text('name').notNull(),

    price: integer('price').notNull(),

    slug: text('slug').notNull().unique(),

    type: planTypeEnum('type').default('individual').notNull(),

    ...timestamps,
});

// Model Pricing Coefficients
export const modelPricings = pgTable(
    'model_pricings',
    {
        id: text('id').primaryKey(),

        inputPrice: numeric('input_price', { precision: 12, scale: 2 }).default('0'),
        model: text('model').notNull(),

        outputPrice: numeric('output_price', { precision: 12, scale: 2 }).default('0'),
        perRequestPrice: numeric('per_request_price', { precision: 12, scale: 2 }).default('0'),
        provider: text('provider').notNull(),

        ...timestamps,
    },
    (t) => [
        {
            uniqueIdx: sql`UNIQUE(${t.model}, ${t.provider})`,
        }
    ]
);

export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type SubscriptionPlanItem = typeof subscriptionPlans.$inferSelect;
export type NewModelPricing = typeof modelPricings.$inferInsert;
export type ModelPricingItem = typeof modelPricings.$inferSelect;
