/* eslint-disable sort-keys-fix/sort-keys-fix */
import { pgTable, varchar } from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './_helpers';

/**
 * 系统级别的默认模型配置（单行表）
 * 存储全局默认使用的AI模型配置
 */
export const systemDefaultModelConfig = pgTable('system_default_model_config', {
  // 主键，固定为 'default'（单行表）
  id: varchar('id', { length: 50 }).primaryKey().default('default'),
  // 模型ID，如 'gpt-4o', 'claude-3-opus'
  modelId: varchar('model_id', { length: 200 }),
  // 显示名称
  displayName: varchar('display_name', { length: 200 }),
  // 供应商ID
  providerId: varchar('provider_id', { length: 64 }),
  // 供应商名称
  providerName: varchar('provider_name', { length: 200 }),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type SystemDefaultModelConfigInsert = typeof systemDefaultModelConfig.$inferInsert;
export type SystemDefaultModelConfigSelect = typeof systemDefaultModelConfig.$inferSelect;
