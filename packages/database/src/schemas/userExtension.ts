import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// 主项目用户扩展表 - 管理订阅信息和扩展字段
export const userExtensions = pgTable(
    'user_extensions',
    {


        currentApiCallsUsed: integer('current_api_calls_used').default(0),




        // 关联主项目用户表 users.id
        // 套餐订阅信息
        currentPlan: text('current_plan').default('free'),







        // 1024MB default
        // 当前使用量
        currentTokensUsed: integer('current_tokens_used').default(0),








        // 上次使用量重置时间
        // 扩展功能开关
        features: jsonb('features').default({}).notNull(),











        id: text('id')
            .primaryKey()
            .default(sql`gen_random_uuid()`),








        // 扩展功能配置
        // 账户状态
        isSuspended: boolean('is_suspended').default(false),










        // 暂停时间
        // 管理备注
        adminNotes: text('admin_notes'),












        // 0表示无限制
        monthlyApiCallsLimit: integer('monthly_api_calls_limit').default(0),










        // 管理员备注
        // 时间戳
        createdAt: timestamp('created_at').defaultNow().notNull(),










        // 套餐过期时间
        // 使用限制
        monthlyTokenLimit: integer('monthly_token_limit').default(0),










        lastUsageReset: timestamp('last_usage_reset').defaultNow(),








        userId: text('user_id').unique().notNull(),






        // 0表示无限制
        monthlyStorageLimit: integer('monthly_storage_limit').default(1024),






        // free, basic, pro, enterprise
        planExpiresAt: timestamp('plan_expires_at'),





        // 是否被暂停
        suspendReason: text('suspend_reason'),


        // 暂停原因
        suspendedAt: timestamp('suspended_at'),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        // 唯一索引
        userIdIdx: uniqueIndex('user_extension_user_id_idx').on(table.userId),
    }),
);

// 套餐历史记录表
export const userSubscriptionHistory = pgTable('user_subscription_history', {
    apiCallsLimit: integer('api_calls_limit').default(0),


    // 开始时间
    endedAt: timestamp('ended_at'),





    features: jsonb('features').default({}).notNull(),



    id: text('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),




    // 交易ID
    createdAt: timestamp('created_at').defaultNow().notNull(),








    // 结束时间
    isActive: boolean('is_active').default(true).notNull(),








    // 是否激活
    // 支付信息
    paymentMethod: text('payment_method'),









    // 套餐类型
    planName: text('plan_name').notNull(),










    // 关联主项目用户ID
    planType: text('plan_type').notNull(),









    // 套餐名称
    price: integer('price').default(0),








    // 套餐特性
    // 时间信息
    startedAt: timestamp('started_at').defaultNow().notNull(),











    userId: text('user_id').notNull(),





    // 价格（分）
    // 套餐配置
    tokenLimit: integer('token_limit').default(0),

    // 支付方式
    transactionId: text('transaction_id'),
});
