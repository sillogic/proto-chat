import {
    boolean,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    numeric
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { idGenerator } from '../utils/idGenerator';
import { timestamps } from './_helpers';

// Plan interval enum
export const planIntervalEnum = pgEnum('plan_interval', ['month', 'year']);

// Plan type enum
export const planTypeEnum = pgEnum('plan_type', ['individual', 'team']);

// Subscription Plans
export const subscriptionPlans = pgTable('subscription_plans', {

    credits: numeric('credits', { precision: 12, scale: 2 }).default('0').notNull(),


    // Price in cents (e.g. 990 for $9.90)
    currency: text('currency').default('CNY').notNull(),

    // Rows/Chunks
    features: jsonb('features').default({}).notNull(),



    id: text('id')
        .primaryKey()
        .$defaultFn(() => idGenerator('plan')),





    interval: planIntervalEnum('interval').default('month').notNull(),



    isActive: boolean('is_active').default(true),




    name: text('name').notNull(),




    price: integer('price').notNull(),


    // e.g., "Lite Monthly", "Pro Yearly"
    slug: text('slug').notNull().unique(),



    // Monthly credit grant
    storageLimit: integer('storage_limit').default(1024).notNull(),



    // e.g., "lite-monthly"
    type: planTypeEnum('type').default('individual').notNull(),

    // MB
    vectorLimit: integer('vector_limit').default(0).notNull(),

    ...timestamps,
});

// Model Pricing Coefficients
export const modelPricings = pgTable('model_pricings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => idGenerator('mp')),

    // e.g. "openai"
    inputPrice: numeric('input_price', { precision: 10, scale: 6 }).default('0'),

    model: text('model').notNull(),


    // Credits per 1000 tokens
    outputPrice: numeric('output_price', { precision: 10, scale: 6 }).default('0'),

    // Credits per 1000 tokens
    perRequestPrice: numeric('per_request_price', { precision: 10, scale: 6 }).default('0'),
    // e.g. "gpt-4"
    provider: text('provider').notNull(), // Credits per request

    ...timestamps,
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const insertModelPricingSchema = createInsertSchema(modelPricings);

export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type SubscriptionPlanItem = typeof subscriptionPlans.$inferSelect;
export type NewModelPricing = typeof modelPricings.$inferInsert;
export type ModelPricingItem = typeof modelPricings.$inferSelect;
