import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const aiProviders = pgTable(
    'ai_providers',
    {
        checkModel: text('check_model'),
        description: text('description'),


        enabled: boolean('enabled'),


        fetchOnClient: boolean('fetch_on_client'),

        id: varchar('id', { length: 64 }).notNull(),

        config: jsonb('config').default({}),

        isGlobal: boolean('is_global').default(false),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

        name: text('name'),


        // need to be encrypted
        keyVaults: text('key_vaults'),

        // 定价同步配置
        pricingSyncStrategy: varchar('pricing_sync_strategy', { length: 50 }),
        pricingApiUrl: varchar('pricing_api_url', { length: 500 }),


        // in admin system, we might not have a formal users relation for all queries, but we keep the field
        sort: integer('sort'),

        logo: text('logo'),
        userId: text('user_id').notNull(),
        settings: jsonb('settings').default({}),

        source: varchar('source', { enum: ['builtin', 'custom'], length: 20 }),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [primaryKey({ columns: [table.id, table.userId] })],
);

export type AiProvider = typeof aiProviders.$inferSelect;
export type NewAiProvider = typeof aiProviders.$inferInsert;

export const aiModels = pgTable(
  'ai_models',
  {
    id: varchar('id', { length: 150 }).notNull(),
    displayName: varchar('display_name', { length: 200 }),
    description: text('description'),
    organization: varchar('organization', { length: 100 }),
    enabled: boolean('enabled'),
    providerId: varchar('provider_id', { length: 64 }).notNull(),
    type: varchar('type', { length: 20 }).default('chat').notNull(),
    sort: integer('sort'),
    userId: text('user_id').notNull(),
    pricing: jsonb('pricing'),
    parameters: jsonb('parameters'),
    config: jsonb('config'),
    abilities: jsonb('abilities'),
    contextWindowTokens: integer('context_window_tokens'),
    source: varchar('source', { enum: ['remote', 'custom', 'builtin'], length: 20 }),
    releasedAt: varchar('released_at', { length: 10 }),
    settings: jsonb('settings'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.providerId, table.userId] }),
    index('ai_models_user_id_idx').on(table.userId),
    index('ai_models_provider_id_idx').on(table.providerId),
  ],
);

export type AiModel = typeof aiModels.$inferSelect;
export type NewAiModel = typeof aiModels.$inferInsert;
