import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

// 用户扩展表 - 管理订阅信息和限制
export const userExtensions = pgTable('user_extensions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // 对应主项目 users.id

  // 套餐信息
  currentPlan: text('current_plan').notNull().default('free'), // free, basic, pro, enterprise
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),

  // 使用量限制
  monthlyTokenLimit: integer('monthly_token_limit').notNull().default(0), // 0=无限制
  monthlyApiCallsLimit: integer('monthly_api_calls_limit').notNull().default(0), // 0=无限制
  monthlyStorageLimit: integer('monthly_storage_limit').notNull().default(1024), // MB

  // 当前使用量 (实时统计，不依赖额外表)
  currentTokensUsed: integer('current_tokens_used').notNull().default(0),
  currentApiCallsUsed: integer('current_api_calls_used').notNull().default(0),
  currentStorageUsed: integer('current_storage_used').notNull().default(0), // MB

  // 上次重置时间
  lastUsageReset: timestamp('last_usage_reset', { withTimezone: true }).defaultNow(),

  // 功能配置
  features: jsonb('features').$type<{
    basicChat: boolean;
    fileUpload: boolean;
    advancedModel: boolean;
    exportHistory: boolean;
    prioritySupport: boolean;
    customAgents: boolean;
    apiAccess: boolean;
  }>().default({
    basicChat: true,
    fileUpload: false,
    advancedModel: false,
    exportHistory: false,
    prioritySupport: false,
    customAgents: false,
    apiAccess: false,
  }),

  // 状态管理
  isSuspended: boolean('is_suspended').notNull().default(false),
  suspendReason: text('suspend_reason'),
  adminNotes: text('admin_notes'),

  // 时间戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('user_extensions_user_id_idx').on(table.userId),
}));

export type UserExtension = typeof userExtensions.$inferSelect;