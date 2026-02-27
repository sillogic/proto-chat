import {
    boolean,
    index,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { idGenerator } from '../utils/idGenerator';
import { timestamps } from './_helpers';
import { users } from './user';

// User credits balance table
export const userBalances = pgTable('user_balances', {
    balance: numeric('balance', { precision: 15, scale: 4 }).default('0').notNull(),
    isUnlimited: boolean('is_unlimited').default(false),
    totalPurchased: numeric('total_purchased', { precision: 15, scale: 4 }).default('0').notNull(),
    userId: text('user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .primaryKey(),

    ...timestamps,
});

export const transactionTypeEnum = pgEnum('transaction_type', [
    'DEPOSIT',
    'CONSUMPTION',
    'REFUND',
    'ADJUSTMENT',
    'SUBSCRIPTION_GRANT',
]);

// Transaction history table
export const userTransactions = pgTable(
    'user_transactions',
    {
        amount: numeric('amount', { precision: 15, scale: 4 }).notNull(),
        balanceAfter: numeric('balance_after', { precision: 15, scale: 4 }),
        category: text('category'),
        // e.g. messageId, paymentId
        description: text('description'),

        id: text('id')
            .primaryKey()
            .$defaultFn(() => idGenerator('userTransactions')),

        metadata: jsonb('metadata'),

        // e.g. 'MODEL_USAGE', 'SUBSCRIPTION'
        refId: text('ref_id'),


        type: transactionTypeEnum('type').notNull(),

        userId: text('user_id')
            .references(() => users.id, { onDelete: 'cascade' })
            .notNull(),

        ...timestamps,
    },
    (t) => [index('user_transactions_user_id_idx').on(t.userId)],
);

export const insertUserBalanceSchema = createInsertSchema(userBalances);
export const insertUserTransactionSchema = createInsertSchema(userTransactions);

export type NewUserBalance = typeof userBalances.$inferInsert;
export type UserBalanceItem = typeof userBalances.$inferSelect;
export type NewUserTransaction = typeof userTransactions.$inferInsert;
export type UserTransactionItem = typeof userTransactions.$inferSelect;
