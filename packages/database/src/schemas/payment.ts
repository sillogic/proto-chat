import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

// Payment Orders
export const paymentOrders = pgTable('payment_orders', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Order number (unique)
  orderNo: varchar('order_no', { length: 64 }).unique().notNull(),

  // User ID
  userId: text('user_id').notNull(),

  // Order content
  planId: text('plan_id').notNull(),
  planInterval: varchar('plan_interval', { length: 10 }).notNull(), // 'month' | 'year'
  amount: integer('amount').notNull(), // Amount in cents
  currency: varchar('currency', { length: 10 }).default('CNY').notNull(),

  // Subscription type: 'recurring' (auto-renew) or 'onetime' (one-time payment)
  subscriptionType: varchar('subscription_type', { length: 20 }).default('recurring').notNull(),
  // Duration in months for one-time payments (1, 3, 6, 12), NULL for recurring
  durationMonths: integer('duration_months'),

  // Payment channel
  payChannel: varchar('pay_channel', { length: 20 }).notNull(), // 'wechat_native' | 'alipay' | ...
  channelOrderNo: varchar('channel_order_no', { length: 128 }), // Channel order number

  // Status
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | paid | closed | refunded
  channelData: jsonb('channel_data'), // Channel-specific data (code_url, etc.)

  // Timestamps
  expiredAt: timestamp('expired_at').notNull(),
  paidAt: timestamp('paid_at'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Payment Notifications
export const paymentNotifications = pgTable('payment_notifications', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Order number
  orderNo: varchar('order_no', { length: 64 }).notNull(),

  // Payment channel
  payChannel: varchar('pay_channel', { length: 20 }).notNull(),

  // Raw notification data
  rawData: text('raw_data').notNull(),

  // Processing status
  status: varchar('status', { length: 20 }).notNull(), // success | fail | duplicate

  // Timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertPaymentOrderSchema = createInsertSchema(paymentOrders);
export const insertPaymentNotificationSchema = createInsertSchema(paymentNotifications);

export type NewPaymentOrder = typeof paymentOrders.$inferInsert;
export type PaymentOrderItem = typeof paymentOrders.$inferSelect;
export type NewPaymentNotification = typeof paymentNotifications.$inferInsert;
export type PaymentNotificationItem = typeof paymentNotifications.$inferSelect;
