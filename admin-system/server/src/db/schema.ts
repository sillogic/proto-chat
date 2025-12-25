import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 用户表 (引用主系统的用户表结构)
export const users = pgTable('users', {
  avatar: text('avatar'),
  email: text('email').unique(),
  banned: boolean('banned').default(false),
  emailVerified: boolean('email_verified').default(false).notNull(),
  banExpires: timestamp('ban_expires'),
  firstName: text('first_name'),
  banReason: text('ban_reason'),
  fullName: text('full_name'),
  emailVerifiedAt: timestamp('email_verified_at'),
  id: text('id').primaryKey().notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  username: text('username').unique(),
  lastName: text('last_name'),
  normalizedEmail: text('normalized_email').unique(),
  phone: text('phone').unique(),
  phoneNumberVerified: boolean('phone_number_verified'),
  role: text('role'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
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

export type User = typeof users.$inferSelect;
export type SystemStat = typeof systemStats.$inferSelect;