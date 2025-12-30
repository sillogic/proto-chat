import {
    boolean,
    index,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Timestamps helper
export const timestamps = {
    createdAt: timestamp('created_at', { mode: 'date', precision: 3 }).default(sql`now()`).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).default(sql`now()`).notNull(),
};

// User credits balance table
export const userBalances = pgTable('user_balances', {
    balance: numeric('balance', { precision: 15, scale: 4 }).default('0').notNull(),
    isUnlimited: boolean('is_unlimited').default(false),
    totalPurchased: numeric('total_purchased', { precision: 15, scale: 4 }).default('0').notNull(),
    userId: text('user_id').primaryKey(), // Simplified references for this server but points to user.id

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
        description: text('description'),
        id: text('id').primaryKey(),
        metadata: jsonb('metadata'),
        refId: text('ref_id'),
        type: transactionTypeEnum('type').notNull(),
        userId: text('user_id').notNull(),

        ...timestamps,
    },
    (t) => [index('user_transactions_user_id_idx').on(t.userId)],
);

export type NewUserBalance = typeof userBalances.$inferInsert;
export type UserBalanceItem = typeof userBalances.$inferSelect;
export type NewUserTransaction = typeof userTransactions.$inferInsert;
export type UserTransactionItem = typeof userTransactions.$inferSelect;
