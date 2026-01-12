-- =============================================
-- 为 ai_providers 表添加在线同步配置字段
-- 用于支持从 API 动态同步模型列表和定价
-- =============================================

-- 添加定价同步策略字段
-- 'api' = 从供应商API获取, 'model_bank' = 从Model-Bank获取, 'manual' = 手动配置
ALTER TABLE "ai_providers"
ADD COLUMN IF NOT EXISTS "pricing_sync_strategy" varchar(50);

-- 添加定价API地址字段
-- 存储供应商的模型列表API地址，如: https://openrouter.ai/api/v1/models
ALTER TABLE "ai_providers"
ADD COLUMN IF NOT EXISTS "pricing_api_url" varchar(500);

-- 为常用查询添加索引
CREATE INDEX IF NOT EXISTS "ai_providers_pricing_sync_strategy_idx"
ON "ai_providers" ("pricing_sync_strategy");

-- 更新现有 ProtoChat 供应商的配置（如果存在）
UPDATE "ai_providers"
SET
  "pricing_sync_strategy" = 'model_bank',
  "pricing_api_url" = NULL
WHERE "id" = 'protochat'
  AND "is_global" = true;

-- 注释
COMMENT ON COLUMN "ai_providers"."pricing_sync_strategy" IS '定价同步策略: api=从API同步, model_bank=从Model-Bank同步, manual=手动配置';
COMMENT ON COLUMN "ai_providers"."pricing_api_url" IS '定价API地址，如: https://openrouter.ai/api/v1/models';
