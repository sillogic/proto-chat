/* eslint-disable sort-keys-fix/sort-keys-fix */
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

import { createdAt, timestamptz, updatedAt } from './_helpers';

/**
 * ProtoChat 底层供应商配置
 * 存储OpenRouter、DeepSeek等底层供应商的API配置
 */
export const protochatProviders = pgTable(
  'protochat_providers',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    // 'aggregator' = 聚合平台(如OpenRouter), 'direct' = 直连供应商(如DeepSeek)
    type: varchar('type', { length: 50 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    // 优先级，用于选择供应商时排序
    priority: integer('priority').default(0),

    // 供应商别名，用于生成模型ID，隐藏真实供应商名称
    // 格式如 a1, b2, c3，在模型ID中使用: protochat::{alias}::{modelId}
    alias: varchar('alias', { length: 10 }),

    // API配置
    apiKey: text('api_key'),
    baseUrl: varchar('base_url', { length: 500 }),
    // 可选的自定义端点
    apiEndpoint: varchar('api_endpoint', { length: 500 }),

    // 定价同步配置
    // 'api' = 从供应商API获取, 'model_bank' = 从Model-Bank获取, 'manual' = 手动配置
    pricingSyncStrategy: varchar('pricing_sync_strategy', { length: 50 }),
    pricingApiUrl: varchar('pricing_api_url', { length: 500 }),

    // 其他配置（JSON格式，可扩展）
    settings: jsonb('settings'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('protochat_providers_enabled_idx').on(table.enabled),
    index('protochat_providers_priority_idx').on(table.priority),
    unique('protochat_providers_alias_unique').on(table.alias),
  ],
);

export type ProtochatProviderInsert = typeof protochatProviders.$inferInsert;
export type ProtochatProviderSelect = typeof protochatProviders.$inferSelect;

/**
 * ProtoChat 模型列表
 * 存储ProtoChat供应商可用的模型及其与底层供应商的映射关系
 */
export const protochatModels = pgTable(
  'protochat_models',
  {
    // ProtoChat模型ID，格式: 'protochat::gpt-4o'
    id: varchar('id', { length: 200 }).primaryKey(),
    // 原始模型ID，格式: 'openrouter::openai/gpt-4o'
    originalId: varchar('original_id', { length: 200 }).notNull(),
    // 原始供应商ID，如: 'openrouter', 'deepseek'
    originalProvider: varchar('original_provider', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    // 模型类型: 'chat', 'image', 'embedding'
    type: varchar('type', { length: 20 }).notNull(),
    // 后台是否启用（控制用户可见性）
    enabled: boolean('enabled').default(false).notNull(),

    // 模型能力: {functionCall, vision, reasoning, search, files, etc}
    capabilities: jsonb('capabilities'),
    contextTokens: integer('context_tokens'),
    maxOutput: integer('max_output'),

    // 模型参数schema
    parameters: jsonb('parameters'),
    // 特殊设置
    settings: jsonb('settings'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('protochat_models_original_provider_idx').on(table.originalProvider),
    index('protochat_models_enabled_idx').on(table.enabled),
    index('protochat_models_type_idx').on(table.type),
    unique('protochat_models_original_id_unique').on(table.originalId),
  ],
);

export type ProtochatModelInsert = typeof protochatModels.$inferInsert;
export type ProtochatModelSelect = typeof protochatModels.$inferSelect;

/**
 * ProtoChat 模型定价
 * 存储每个模型的成本价和用户价
 */
export const protochatModelPricing = pgTable(
  'protochat_model_pricing',
  {
    id: serial('id').primaryKey(),
    // 关联protochat_models.id
    modelId: varchar('model_id', { length: 200 }).notNull(),

    // 成本价（USD/百万tokens）
    costInputPrice: decimal('cost_input_price', { precision: 15, scale: 4 }).notNull(),
    costOutputPrice: decimal('cost_output_price', { precision: 15, scale: 4 }).notNull(),

    // 原始货币: 'USD', 'CNY'
    currency: varchar('currency', { length: 10 }).default('USD'),
    // 定价来源: 'api', 'model_bank', 'manual'
    priceSource: varchar('price_source', { length: 50 }),
    // 是否免费模型
    isFree: boolean('is_free').default(false),

    // 最后同步时间
    syncedAt: timestamptz('synced_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('protochat_pricing_model_id_unique').on(table.modelId),
    index('protochat_pricing_model_id_idx').on(table.modelId),
    index('protochat_pricing_synced_at_idx').on(table.syncedAt),
  ],
);

export type ProtochatModelPricingInsert = typeof protochatModelPricing.$inferInsert;
export type ProtochatModelPricingSelect = typeof protochatModelPricing.$inferSelect;

/**
 * ProtoChat 全局设置
 * 存储定价系数等全局配置
 */
export const protochatSettings = pgTable('protochat_settings', {
  // 设置项ID，如: 'pricing_multiplier'
  id: varchar('id', { length: 50 }).primaryKey(),
  // 设置值
  value: decimal('value', { precision: 10, scale: 4 }).notNull(),
  description: varchar('description', { length: 500 }),
  updatedAt: updatedAt(),
});

export type ProtochatSettingsInsert = typeof protochatSettings.$inferInsert;
export type ProtochatSettingsSelect = typeof protochatSettings.$inferSelect;

/**
 * ProtoChat 使用日志
 * 记录用户使用ProtoChat模型的详细日志，用于分析和审计
 */
export const protochatUsageLogs = pgTable(
  'protochat_usage_logs',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    modelId: varchar('model_id', { length: 200 }).notNull(),
    originalProvider: varchar('original_provider', { length: 64 }).notNull(),

    // Token使用量
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),

    // 费用记录
    costPrice: decimal('cost_price', { precision: 15, scale: 4 }),
    userPrice: decimal('user_price', { precision: 15, scale: 4 }),

    // 请求信息
    requestId: varchar('request_id', { length: 100 }),

    createdAt: createdAt(),
  },
  (table) => [
    index('protochat_usage_user_id_idx').on(table.userId),
    index('protochat_usage_model_id_idx').on(table.modelId),
    index('protochat_usage_created_at_idx').on(table.createdAt),
    index('protochat_usage_original_provider_idx').on(table.originalProvider),
  ],
);

export type ProtochatUsageLogInsert = typeof protochatUsageLogs.$inferInsert;
export type ProtochatUsageLogSelect = typeof protochatUsageLogs.$inferSelect;
