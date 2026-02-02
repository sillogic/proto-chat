import { sql } from 'drizzle-orm';
import { date, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

/**
 * 用户签约协议表 - 管理支付宝/微信周期扣款签约信息
 */
export const userAgreements = pgTable('user_agreements', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // 用户ID
  userId: text('user_id').notNull(),

  // ============ 签约信息 ============
  // 支付宝返回的协议号
  agreementNo: varchar('agreement_no', { length: 64 }),
  // 商户签约号（我们生成，唯一标识用户签约）
  externalAgreementNo: varchar('external_agreement_no', { length: 64 }).unique().notNull(),
  // 签约场景 如 INDUSTRY|DIGITAL_MEDIA
  signScene: varchar('sign_scene', { length: 64 }).notNull(),
  // 签约渠道 alipay | wechat
  signChannel: varchar('sign_channel', { length: 20 }).notNull(),

  // ============ 关联订阅 ============
  // 关联的套餐ID
  planId: text('plan_id').notNull(),
  // 套餐slug (pro/ultra)
  planSlug: varchar('plan_slug', { length: 32 }).notNull(),
  // 套餐名称
  planName: varchar('plan_name', { length: 64 }).notNull(),
  // 计费周期 month/year
  billingInterval: varchar('billing_interval', { length: 10 }).notNull(),

  // ============ 扣款规则 ============
  // 单次扣款金额（分）
  singleAmount: integer('single_amount').notNull(),
  // 周期类型 DAY/MONTH
  periodType: varchar('period_type', { length: 10 }).notNull(),
  // 周期数
  period: integer('period').notNull(),
  // 下次扣款日期
  nextDeductDate: date('next_deduct_date'),

  // ============ 签约状态 ============
  // pending: 待签约, signed: 已签约, unsigned: 已解约
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  // 签约时间
  signTime: timestamp('sign_time'),
  // 解约时间
  unsignTime: timestamp('unsign_time'),
  // 解约原因: user_unsign(用户主动解约), merchant_unsign(商户解约), expired(过期)
  unsignReason: varchar('unsign_reason', { length: 32 }),

  // ============ 扣款状态 ============
  // 上次扣款状态 success/failed/pending
  lastDeductStatus: varchar('last_deduct_status', { length: 20 }),
  // 上次扣款时间
  lastDeductTime: timestamp('last_deduct_time'),
  // 上次扣款订单号
  lastDeductOrderNo: varchar('last_deduct_order_no', { length: 64 }),
  // 当天扣款失败次数（用于重试逻辑）
  deductFailCount: integer('deduct_fail_count').default(0),
  // 扣款失败原因
  deductFailReason: text('deduct_fail_reason'),

  // ============ 支付宝用户信息 ============
  // 支付宝用户ID
  alipayUserId: varchar('alipay_user_id', { length: 64 }),
  // 支付宝用户OpenID
  alipayOpenId: varchar('alipay_open_id', { length: 128 }),
  // 支付宝登录账号（脱敏）
  alipayLogonId: varchar('alipay_logon_id', { length: 64 }),

  // ============ 扩展信息 ============
  // 签约时的首次支付订单号
  firstOrderNo: varchar('first_order_no', { length: 64 }),
  // 其他元数据
  metadata: jsonb('metadata'),

  // ============ 时间戳 ============
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertUserAgreementSchema = createInsertSchema(userAgreements);

export type NewUserAgreement = typeof userAgreements.$inferInsert;
export type UserAgreementItem = typeof userAgreements.$inferSelect;
