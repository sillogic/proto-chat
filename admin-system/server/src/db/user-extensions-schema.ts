import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 用户扩展表 - 管理订阅信息和限制
export const userExtensions = pgTable('user_extensions', {


  accessedAt: timestamp('accessed_at'),

  // Basic Info & Metadata
  adminNotes: text('admin_notes'),

  // 当前计费周期 'month' | 'year'，free 用户为 NULL
  billingInterval: text('billing_interval'),

  clerkCreatedAt: timestamp('clerk_created_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  interests: text('interests').array(),


  // Plan & Subscription
  currentPlan: text('current_plan').default('free'),
  planId: text('plan_id'),





  isOnboarded: boolean('is_onboarded').default(false),

  // Status & Flags
  isSuspended: boolean('is_suspended').default(false),

  lastUsageReset: timestamp('last_usage_reset').defaultNow(),
  userId: text('user_id').notNull().unique(),
  onboarding: jsonb('onboarding'),

  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // Feature Flags
  features: jsonb('features').default({}).notNull(),

  suspendReason: text('suspend_reason'),

  suspendedAt: timestamp('suspended_at'),

  planExpiresAt: timestamp('plan_expires_at'),

  // 下次积分发放时间
  nextCreditGrantAt: timestamp('next_credit_grant_at'),

  // 下一个计费周期预设的方案 ID (用于中途降级或取消订阅)
  nextPlanId: text('next_plan_id'),

  preference: jsonb('preference').default({}),
}, (table) => ({
  userIdIdx: index('user_extension_user_id_idx').on(table.userId),
}));

export type UserExtension = typeof userExtensions.$inferSelect;

// 套餐历史记录表
export const userSubscriptionHistory = pgTable('user_subscription_history', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull(),

  // Plan Info
  planName: text('plan_name').notNull(),
  planType: text('plan_type').notNull(), // individual, team
  planId: text('plan_id'),
  slug: text('slug').notNull(), // plan_free, plan_pro, etc.

  // Configuration snapshots
  features: jsonb('features').default({}).notNull(),

  // Payment Info
  price: integer('price').default(0), // Price in cents
  billingInterval: text('billing_interval'), // 计费周期
  orderNo: varchar('order_no', { length: 64 }), // 关联订单号
  paymentMethod: text('payment_method'),
  transactionId: text('transaction_id'),

  // Status & Time
  isActive: boolean('is_active').default(true).notNull(),
  status: text('status').default('active').notNull(), // active, canceled, expired, past_due, upgraded
  autoRenew: boolean('auto_renew').default(true).notNull(),
  startedAt: timestamp('started_at', { precision: 3 }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { precision: 3 }),

  createdAt: timestamp('created_at', { precision: 3 }).defaultNow().notNull(),
});

export type UserSubscriptionHistory = typeof userSubscriptionHistory.$inferSelect;