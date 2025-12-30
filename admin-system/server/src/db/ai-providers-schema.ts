import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core';

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
