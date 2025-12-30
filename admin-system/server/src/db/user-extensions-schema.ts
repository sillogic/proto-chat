import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 用户扩展表 - 管理订阅信息和限制
export const userExtensions = pgTable('user_extensions', {


  accessedAt: timestamp('accessed_at'),

  // Basic Info & Metadata
  adminNotes: text('admin_notes'),


  clerkCreatedAt: timestamp('clerk_created_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  interests: text('interests').array(),


  // Plan & Subscription
  currentPlan: text('current_plan').default('free'),





  isOnboarded: boolean('is_onboarded').default(false),

  // Status & Flags
  isSuspended: boolean('is_suspended').default(false),

  lastUsageReset: timestamp('last_usage_reset').defaultNow(),

  monthlyApiCallsLimit: integer('monthly_api_calls_limit').default(0),

  userId: text('user_id').notNull().unique(),

  // Current Usage counts
  currentTokensUsed: integer('current_tokens_used').default(0),


  onboarding: jsonb('onboarding'),



  currentApiCallsUsed: integer('current_api_calls_used').default(0),

  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // Feature Flags
  features: jsonb('features').default({}).notNull(),




  suspendReason: text('suspend_reason'),



  monthlyStorageLimit: integer('monthly_storage_limit').default(1024),



  suspendedAt: timestamp('suspended_at'),




  // Limits
  monthlyTokenLimit: integer('monthly_token_limit').default(0),



  planExpiresAt: timestamp('plan_expires_at'),



  preference: jsonb('preference').default({}),
}, (table) => ({
  userIdIdx: index('user_extension_user_id_idx').on(table.userId),
}));

export type UserExtension = typeof userExtensions.$inferSelect;