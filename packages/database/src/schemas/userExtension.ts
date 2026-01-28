import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

// 主项目用户扩展表 - 管理订阅信息和扩展字段
export const userExtensions = pgTable(
    'user_extensions',
    {


        accessedAt: timestamp('accessed_at').defaultNow(),






        // 暂停时间
        // 管理备注
        adminNotes: text('admin_notes'),

        // 当前计费周期 'month' | 'year'，free 用户为 NULL
        billingInterval: text('billing_interval'),













        clerkCreatedAt: timestamp('clerk_created_at'),
















        // 管理员备注
        // 时间戳
        createdAt: timestamp('created_at').defaultNow().notNull(),









        // 关联主项目用户表 users.id
        // 套餐订阅信息
        currentPlan: text('current_plan').default('free'),
        // 上次使用量重置时间
        // 扩展功能开关
        features: jsonb('features').default({}).notNull(),








        id: text('id')
            .primaryKey()
            .default(sql`gen_random_uuid()`),




        interests: text('interests').array(),




        isOnboarded: boolean('is_onboarded').default(false),




        // 扩展功能配置
        // 账户状态
        isSuspended: boolean('is_suspended').default(false),









        lastUsageReset: timestamp('last_usage_reset').defaultNow(),


















        // 下次积分发放时间
        nextCreditGrantAt: timestamp('next_credit_grant_at'),

        // 下一个计费周期预设的方案 ID (用于中途降级或取消订阅)
        nextPlanId: text('next_plan_id'),



















        onboarding: jsonb('onboarding'),


        // free, basic, pro, enterprise
        planExpiresAt: timestamp('plan_expires_at'),

        planId: text('plan_id'),








        preference: jsonb('preference'),







        // 是否被暂停
        suspendReason: text('suspend_reason'),






        // 暂停原因
        suspendedAt: timestamp('suspended_at'),



        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        userId: text('user_id').unique().notNull(),
    },
    (table) => ({
        // 唯一索引
        userIdIdx: uniqueIndex('user_extension_user_id_idx').on(table.userId),
    }),
);

// 套餐历史记录表
export const userSubscriptionHistory = pgTable('user_subscription_history', {



    // active, canceled, expired, past_due, upgraded
    autoRenew: boolean('auto_renew').default(true).notNull(),








    // 交易ID
    createdAt: timestamp('created_at').defaultNow().notNull(),





    // 开始时间
    endedAt: timestamp('ended_at'),






    features: jsonb('features').default({}).notNull(),










    id: text('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    // 结束时间
    isActive: boolean('is_active').default(true).notNull(),
    // 是否激活
    // 支付信息
    paymentMethod: text('payment_method'),










    planId: text('plan_id'),










    // 套餐类型
    planName: text('plan_name').notNull(),












    // 关联主项目用户ID
    planType: text('plan_type').notNull(),

    // 套餐名称
    price: integer('price').default(0),

    // 计费周期
    billingInterval: text('billing_interval'),

    // 关联订单号
    orderNo: varchar('order_no', { length: 64 }),

    slug: text('slug'),










    // 套餐特性
    // 时间信息
    startedAt: timestamp('started_at').defaultNow().notNull(),










    status: text('status').default('active').notNull(),











    // 支付方式
    transactionId: text('transaction_id'),


    userId: text('user_id').notNull(),
});
