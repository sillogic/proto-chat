import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 管理员用户表
export const adminUsers = pgTable('admin_users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  username: text('username').unique().notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash'),
  role: text('role').default('admin').notNull(),
  permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  casdoorId: text('casdoor_id'), // Casdoor用户ID
  authMethod: text('auth_method').default('local').notNull(), // local, casdoor
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 用户表 (引用主系统的用户表结构)
export const users = pgTable('users', {
  id: text('id').primaryKey().notNull(),
  username: text('username').unique(),
  email: text('email').unique(),
  normalizedEmail: text('normalized_email').unique(),
  avatar: text('avatar'),
  phone: text('phone').unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  fullName: text('full_name'),
  displayName: text('display_name'),
  isOnboarded: boolean('is_onboarded').default(false),
  clerkCreatedAt: timestamp('clerk_created_at'),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerifiedAt: timestamp('email_verified_at'),
  preference: jsonb('preference').default({}).notNull(),
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  phoneNumberVerified: boolean('phone_number_verified'),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  settings: jsonb('settings').default({}), // 用户设置，包括casdoorId等信息
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 用户套餐表
export const userPlans = pgTable('user_plans', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planType: text('plan_type').notNull(), // free, basic, pro, enterprise
  planName: text('plan_name').notNull(),
  features: jsonb('features').$type<Record<string, any>>().default({}).notNull(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// API Keys 表
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyType: text('key_type').notNull(), // openai, anthropic, etc.
  keyValue: text('key_value').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 系统统计表
export const systemStats = pgTable('system_stats', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp('date').defaultNow().notNull(),
  totalUsers: integer('total_users').default(0).notNull(),
  activeUsers: integer('active_users').default(0).notNull(),
  newUsers: integer('new_users').default(0).notNull(),
  totalApiCalls: integer('total_api_calls').default(0).notNull(),
  totalTokensUsed: integer('total_tokens_used').default(0).notNull(),
  revenue: integer('revenue').default(0).notNull(), // in cents
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;

export type User = typeof users.$inferSelect;
export type UserPlan = typeof userPlans.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type SystemStat = typeof systemStats.$inferSelect;