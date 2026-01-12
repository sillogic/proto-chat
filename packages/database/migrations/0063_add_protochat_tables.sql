-- ============================================
-- ProtoChat 自有供应商数据库Schema
-- Migration: 0063_add_protochat_tables
-- Date: 2026-01-07
-- Description: 添加ProtoChat供应商相关的5张表
-- ============================================

-- 1. 底层供应商配置表
CREATE TABLE IF NOT EXISTS "protochat_providers" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "type" varchar(50) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "priority" integer DEFAULT 0,
  "api_key" text,
  "base_url" varchar(500),
  "api_endpoint" varchar(500),
  "pricing_sync_strategy" varchar(50),
  "pricing_api_url" varchar(500),
  "settings" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "protochat_providers_enabled_idx" ON "protochat_providers" USING btree ("enabled");
CREATE INDEX IF NOT EXISTS "protochat_providers_priority_idx" ON "protochat_providers" USING btree ("priority");

-- 2. ProtoChat模型列表
CREATE TABLE IF NOT EXISTS "protochat_models" (
  "id" varchar(200) PRIMARY KEY NOT NULL,
  "original_id" varchar(200) NOT NULL,
  "original_provider" varchar(64) NOT NULL,
  "display_name" varchar(200) NOT NULL,
  "type" varchar(20) NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "capabilities" jsonb,
  "context_tokens" integer,
  "max_output" integer,
  "parameters" jsonb,
  "settings" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "protochat_models_original_provider_idx" ON "protochat_models" USING btree ("original_provider");
CREATE INDEX IF NOT EXISTS "protochat_models_enabled_idx" ON "protochat_models" USING btree ("enabled");
CREATE INDEX IF NOT EXISTS "protochat_models_type_idx" ON "protochat_models" USING btree ("type");
CREATE UNIQUE INDEX IF NOT EXISTS "protochat_models_original_id_unique" ON "protochat_models" USING btree ("original_id");

-- 3. ProtoChat模型定价
CREATE TABLE IF NOT EXISTS "protochat_model_pricing" (
  "id" serial PRIMARY KEY NOT NULL,
  "model_id" varchar(200) NOT NULL,
  "cost_input_price" numeric(15, 4) NOT NULL,
  "cost_output_price" numeric(15, 4) NOT NULL,
  "user_input_price" numeric(15, 4) NOT NULL,
  "user_output_price" numeric(15, 4) NOT NULL,
  "currency" varchar(10) DEFAULT 'USD',
  "price_source" varchar(50),
  "is_free" boolean DEFAULT false,
  "synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "protochat_pricing_model_id_unique" ON "protochat_model_pricing" USING btree ("model_id");
CREATE INDEX IF NOT EXISTS "protochat_pricing_model_id_idx" ON "protochat_model_pricing" USING btree ("model_id");
CREATE INDEX IF NOT EXISTS "protochat_pricing_synced_at_idx" ON "protochat_model_pricing" USING btree ("synced_at");

-- 4. ProtoChat全局设置
CREATE TABLE IF NOT EXISTS "protochat_settings" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "value" numeric(10, 4) NOT NULL,
  "description" varchar(500),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. ProtoChat使用日志
CREATE TABLE IF NOT EXISTS "protochat_usage_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "model_id" varchar(200) NOT NULL,
  "original_provider" varchar(64) NOT NULL,
  "input_tokens" integer NOT NULL,
  "output_tokens" integer NOT NULL,
  "total_tokens" integer NOT NULL,
  "cost_price" numeric(15, 4),
  "user_price" numeric(15, 4),
  "request_id" varchar(100),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "protochat_usage_user_id_idx" ON "protochat_usage_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "protochat_usage_model_id_idx" ON "protochat_usage_logs" USING btree ("model_id");
CREATE INDEX IF NOT EXISTS "protochat_usage_created_at_idx" ON "protochat_usage_logs" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "protochat_usage_original_provider_idx" ON "protochat_usage_logs" USING btree ("original_provider");

-- ============================================
-- 初始化数据
-- ============================================

-- 初始化定价系数（默认1.0 = 成本价）
INSERT INTO "protochat_settings" ("id", "value", "description")
VALUES ('pricing_multiplier', 1.0, '定价系数：用户价 = 成本价 × 系数')
ON CONFLICT ("id") DO NOTHING;

-- 初始化OpenRouter供应商配置
INSERT INTO "protochat_providers" ("id", "name", "type", "enabled", "priority", "base_url", "pricing_sync_strategy")
VALUES (
  'openrouter',
  'OpenRouter',
  'aggregator',
  true,
  10,
  'https://openrouter.ai/api/v1',
  'api'
)
ON CONFLICT ("id") DO NOTHING;

-- 初始化DeepSeek供应商配置
INSERT INTO "protochat_providers" ("id", "name", "type", "enabled", "priority", "base_url", "pricing_sync_strategy")
VALUES (
  'deepseek',
  'DeepSeek',
  'direct',
  true,
  5,
  'https://api.deepseek.com',
  'model_bank'
)
ON CONFLICT ("id") DO NOTHING;
