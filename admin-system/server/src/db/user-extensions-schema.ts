import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 用户扩展表 - 管理订阅信息和限制
export const userExtensions = pgTable('user_extensions', {


  adminNotes: text('admin_notes'),






  // 时间戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),











  currentApiCallsUsed: integer('current_api_calls_used').notNull().default(0),









  // 对应主项目 users.id
  // 套餐信息
  currentPlan: text('current_plan').notNull().default('free'),












  currentStorageUsed: integer('current_storage_used').notNull().default(0),









  // 个数
  // 当前使用量 (实时统计，不依赖额外表)
  currentTokensUsed: integer('current_tokens_used').notNull().default(0),









  // MB
  currentVectorsUsed: integer('current_vectors_used').notNull().default(0),









  // 功能配置
  features: jsonb('features').$type<{
    advancedModel: boolean;
    apiAccess: boolean;
    basicChat: boolean;
    customAgents: boolean;
    exportHistory: boolean;
    fileUpload: boolean;
    prioritySupport: boolean;
  }>().default({
    advancedModel: false,
    apiAccess: false,
    basicChat: true,
    customAgents: false,
    exportHistory: false,
    fileUpload: false,
    prioritySupport: false,
  }),










  id: serial('id').primaryKey(),








  // 状态管理
  isSuspended: boolean('is_suspended').notNull().default(false),









  // 上次重置时间
  lastUsageReset: timestamp('last_usage_reset', { withTimezone: true }).defaultNow(),








  // 0=无限制
  monthlyApiCallsLimit: integer('monthly_api_calls_limit').notNull().default(0),











  // 0=无限制
  monthlyStorageLimit: integer('monthly_storage_limit').notNull().default(1024),












  // 使用量限制
  monthlyTokenLimit: integer('monthly_token_limit').notNull().default(0),












  // MB
  monthlyVectorLimit: integer('monthly_vector_limit').notNull().default(100),





  // free, basic, pro, enterprise
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),








  // 订阅开始时间（用于计算重置周期）
  planStartedAt: timestamp('plan_started_at', { withTimezone: true }).defaultNow(),




  suspendReason: text('suspend_reason'),


  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  userId: text('user_id').notNull().unique(),
}, (table) => ({
  userIdIdx: index('user_extensions_user_id_idx').on(table.userId),
}));

export type UserExtension = typeof userExtensions.$inferSelect;