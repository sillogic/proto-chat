import { pgTable, text, timestamp, boolean, jsonb, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 主项目用户扩展表 - 管理订阅信息和扩展字段
export const userExtensions = pgTable('user_extensions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').unique().notNull(), // 关联主项目用户表 users.id

  // 套餐订阅信息
  currentPlan: text('current_plan').default('free'), // free, basic, pro, enterprise
  planExpiresAt: timestamp('plan_expires_at'), // 套餐过期时间

  // 使用限制
  monthlyTokenLimit: integer('monthly_token_limit').default(0), // 0表示无限制
  monthlyApiCallsLimit: integer('monthly_api_calls_limit').default(0), // 0表示无限制

  // 当前使用量
  currentTokensUsed: integer('current_tokens_used').default(0),
  currentApiCallsUsed: integer('current_api_calls_used').default(0),
  lastUsageReset: timestamp('last_usage_reset').defaultNow(), // 上次使用量重置时间

  // 扩展功能开关
  features: jsonb('features').default({}).notNull(), // 扩展功能配置

  // 账户状态
  isSuspended: boolean('is_suspended').default(false), // 是否被暂停
  suspendReason: text('suspend_reason'), // 暂停原因
  suspendedAt: timestamp('suspended_at'), // 暂停时间

  // 管理备注
  adminNotes: text('admin_notes'), // 管理员备注

  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // 唯一索引
  userIdIdx: uniqueIndex('user_extension_user_id_idx').on(table.userId),
}));

// 套餐历史记录表
export const userSubscriptionHistory = pgTable('user_subscription_history', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull(), // 关联主项目用户ID

  planType: text('plan_type').notNull(), // 套餐类型
  planName: text('plan_name').notNull(), // 套餐名称
  price: integer('price').default(0), // 价格（分）

  // 套餐配置
  tokenLimit: integer('token_limit').default(0),
  apiCallsLimit: integer('api_calls_limit').default(0),
  features: jsonb('features').default({}).notNull(), // 套餐特性

  // 时间信息
  startedAt: timestamp('started_at').defaultNow().notNull(), // 开始时间
  endedAt: timestamp('ended_at'), // 结束时间
  isActive: boolean('is_active').default(true).notNull(), // 是否激活

  // 支付信息
  paymentMethod: text('payment_method'), // 支付方式
  transactionId: text('transaction_id'), // 交易ID

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type UserExtension = typeof userExtensions.$inferSelect;
export type NewUserExtension = typeof userExtensions.$inferInsert;
export type UserSubscriptionHistory = typeof userSubscriptionHistory.$inferSelect;
export type NewUserSubscriptionHistory = typeof userSubscriptionHistory.$inferInsert;