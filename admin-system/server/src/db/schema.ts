import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 用户表 (引用主系统的用户表结构)
export const users = pgTable('users', {
  avatar: text('avatar'),
  banExpires: timestamp('ban_expires'),
  banReason: text('ban_reason'),
  banned: boolean('banned').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  email: text('email').unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerifiedAt: timestamp('email_verified_at'),
  firstName: text('first_name'),
  fullName: text('full_name'),
  id: text('id').primaryKey().notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  lastName: text('last_name'),
  normalizedEmail: text('normalized_email').unique(),
  phone: text('phone').unique(),
  phoneNumberVerified: boolean('phone_number_verified'),
  role: text('role'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  username: text('username').unique(),
});


// 系统统计表
export const systemStats = pgTable('system_stats', {
  activeUsers: integer('active_users').default(0).notNull(),
  // in cents
  createdAt: timestamp('created_at').defaultNow().notNull(),

  date: timestamp('date').defaultNow().notNull(),

  id: text('id').primaryKey().default(sql`gen_random_uuid()`),

  newUsers: integer('new_users').default(0).notNull(),

  revenue: integer('revenue').default(0).notNull(),

  totalApiCalls: integer('total_api_calls').default(0).notNull(),

  totalTokensUsed: integer('total_tokens_used').default(0).notNull(),
  totalUsers: integer('total_users').default(0).notNull(),
});

// 后台管理员用户表
export const adminUsers = pgTable('admin_users', {
  authMethod: text('auth_method').default('local'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  email: text('email').unique().notNull(),

  id: text('id').primaryKey().default(sql`gen_random_uuid()`),


  isActive: boolean('is_active').default(true).notNull(),

  lastLoginAt: timestamp('last_login_at'),

  passwordHash: text('password_hash').notNull(),
  // admin, super_admin
  permissions: jsonb('permissions').default([]).notNull(),
  role: text('role').default('admin').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  username: text('username').unique().notNull(),
});

// 定时任务执行日志表
export const cronJobLogs = pgTable('cron_job_logs', {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  durationMs: integer('duration_ms'),
  error: text('error'),
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  jobName: text('job_name').notNull(),
  jobPath: text('job_path').notNull(),
  result: jsonb('result'),
  status: text('status').notNull(), // 'success' | 'error'
});

export type User = typeof users.$inferSelect;
export type SystemStat = typeof systemStats.$inferSelect;
export type CronJobLog = typeof cronJobLogs.$inferSelect;