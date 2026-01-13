/* eslint-disable sort-keys-fix/sort-keys-fix */
import {
  decimal,
  index,
  integer,
  pgTable,
  serial,
  text,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { createdAt, timestamptz, updatedAt } from './_helpers';

/**
 * 系统级别的Embedding配置（单行表）
 * 存储全局使用的embedding模型配置
 */
export const systemEmbeddingConfig = pgTable('system_embedding_config', {
  // 主键，固定为 'default'（单行表）
  id: varchar('id', { length: 50 }).primaryKey().default('default'),
  // 供应商ID，如 'openrouter', 'openai'
  providerId: varchar('provider_id', { length: 64 }).notNull(),
  // 模型ID，如 'qwen/qwen3-embedding-4b'
  modelId: varchar('model_id', { length: 200 }).notNull(),
  // 显示名称
  displayName: varchar('display_name', { length: 200 }),

  // API配置（加密存储）
  apiKey: text('api_key'),
  baseUrl: varchar('base_url', { length: 500 }),
  modelsSyncUrl: varchar('models_sync_url', { length: 500 }),

  // 定价（积分/百万tokens）
  inputPrice: decimal('input_price', { precision: 15, scale: 4 }),
  currency: varchar('currency', { length: 10 }).default('USD'),

  // 模型元数据
  contextTokens: integer('context_tokens'),
  dimensions: integer('dimensions').default(1024),

  // 最后同步时间
  lastSyncedAt: timestamptz('last_synced_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type SystemEmbeddingConfigInsert = typeof systemEmbeddingConfig.$inferInsert;
export type SystemEmbeddingConfigSelect = typeof systemEmbeddingConfig.$inferSelect;

/**
 * Embedding可用模型列表
 * 存储从供应商同步的embedding模型信息，仅供选择使用
 */
export const systemEmbeddingModels = pgTable(
  'system_embedding_models',
  {
    id: serial('id').primaryKey(),
    // 模型ID，如 'qwen/qwen3-embedding-4b'
    modelId: varchar('model_id', { length: 200 }).notNull(),
    // 显示名称
    displayName: varchar('display_name', { length: 200 }).notNull(),
    // 供应商ID
    providerId: varchar('provider_id', { length: 64 }).notNull(),

    // 模型能力
    dimensions: integer('dimensions').default(1024),
    contextTokens: integer('context_tokens'),

    // 定价信息（从同步API获取）
    inputPrice: decimal('input_price', { precision: 15, scale: 4 }),
    currency: varchar('currency', { length: 10 }).default('USD'),

    // 同步时间
    syncedAt: timestamptz('synced_at'),
    createdAt: createdAt(),
  },
  (table) => [
    unique('system_embedding_models_model_id_unique').on(table.modelId),
    index('idx_system_embedding_models_provider').on(table.providerId),
  ],
);

export type SystemEmbeddingModelInsert = typeof systemEmbeddingModels.$inferInsert;
export type SystemEmbeddingModelSelect = typeof systemEmbeddingModels.$inferSelect;

/**
 * Embedding使用日志
 * 记录用户使用embedding的详细日志，用于成本分析和审计
 */
export const embeddingUsageLogs = pgTable(
  'embedding_usage_logs',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    modelId: varchar('model_id', { length: 200 }).notNull(),
    providerId: varchar('provider_id', { length: 64 }).notNull(),

    // Token使用量
    inputTokens: integer('input_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),

    // 费用记录（使用 scale: 8 以支持极小的成本值，如 $0.00000001）
    costPrice: decimal('cost_price', { precision: 15, scale: 8 }),
    userPrice: decimal('user_price', { precision: 15, scale: 8 }),

    // 操作上下文
    operationType: varchar('operation_type', { length: 50 }), // 'file_chunking', 'semantic_search', 'rag_eval'
    fileId: text('file_id'), // 如果是文件嵌入（对应 files.id - text类型）
    chunkCount: integer('chunk_count'), // 批量嵌入的chunk数量

    createdAt: createdAt(),
  },
  (table) => [
    index('idx_embedding_usage_user').on(table.userId),
    index('idx_embedding_usage_created').on(table.createdAt),
  ],
);

export type EmbeddingUsageLogInsert = typeof embeddingUsageLogs.$inferInsert;
export type EmbeddingUsageLogSelect = typeof embeddingUsageLogs.$inferSelect;
