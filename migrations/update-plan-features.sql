-- ============================================================================
-- 更新订阅方案的 features 字段（基于原有硬编码数据）
--
-- 用途：修复迁移后缺失的 features 数据
-- 使用方法：在 pgAdmin 中直接执行此脚本
-- ============================================================================

BEGIN;

-- 更新 Lite 方案
UPDATE subscription_plans
SET features = '{
  "display": {
    "description": "适合轻度使用 AI 的用户",
    "model_estimates": [
      {"model": "GPT-5 mini", "count": "约 7,000 条"},
      {"model": "DeepSeek V3.2", "count": "约 1,900 条"}
    ]
  },
  "resources": {
    "credits_per_month": "5,000,000",
    "file_storage_gb": "1.0",
    "vector_storage": "5,000 条",
    "vector_storage_display": "≈ 50MB"
  },
  "cloud_services": {
    "unlimited_history": true,
    "global_sync": true,
    "web_search": true
  },
  "support": {
    "level": "邮件和社区论坛"
  },
  "capabilities": {
    "custom_api": true,
    "unlimited_messages": true
  }
}'::jsonb
WHERE slug = 'lite';

-- 更新 Pro 方案
UPDATE subscription_plans
SET features = '{
  "display": {
    "description": "为频繁使用 AI 的专业用户设计",
    "model_estimates": [
      {"model": "GPT-5 mini", "count": "约 21,100 条"},
      {"model": "DeepSeek V3.2", "count": "约 5,800 条"}
    ]
  },
  "resources": {
    "credits_per_month": "15,000,000",
    "file_storage_gb": "2.0",
    "vector_storage": "10,000 条",
    "vector_storage_display": "≈ 100MB"
  },
  "cloud_services": {
    "unlimited_history": true,
    "global_sync": true,
    "web_search": true
  },
  "support": {
    "level": "优先邮件支持"
  },
  "capabilities": {
    "custom_api": true,
    "unlimited_messages": true
  }
}'::jsonb
WHERE slug IN ('pro', 'premium');

-- 更新 Ultra 方案
UPDATE subscription_plans
SET features = '{
  "display": {
    "description": "针对需要更高 AI 复杂对话的重度用户",
    "model_estimates": [
      {"model": "GPT-5 mini", "count": "约 49,100 条"},
      {"model": "DeepSeek V3.2", "count": "约 13,400 条"}
    ]
  },
  "resources": {
    "credits_per_month": "35,000,000",
    "file_storage_gb": "4.0",
    "vector_storage": "20,000 条",
    "vector_storage_display": "≈ 200MB"
  },
  "cloud_services": {
    "unlimited_history": true,
    "global_sync": true,
    "web_search": true
  },
  "support": {
    "level": "优先邮件和即时支持"
  },
  "capabilities": {
    "custom_api": true,
    "unlimited_messages": true
  }
}'::jsonb
WHERE slug IN ('ultra', 'elite', 'enterprise');

-- 如果有 Free 方案，也更新一下（根据合理推测）
UPDATE subscription_plans
SET features = '{
  "display": {
    "description": "适合新用户体验",
    "model_estimates": [
      {"model": "GPT-5 mini", "count": "约 500 条"},
      {"model": "DeepSeek V3.2", "count": "约 140 条"}
    ]
  },
  "resources": {
    "credits_per_month": "350,000",
    "file_storage_gb": "0.5",
    "vector_storage": "1,000 条",
    "vector_storage_display": "≈ 10MB"
  },
  "cloud_services": {
    "unlimited_history": false,
    "global_sync": true,
    "web_search": false
  },
  "support": {
    "level": "社区论坛"
  },
  "capabilities": {
    "custom_api": false,
    "unlimited_messages": false
  }
}'::jsonb
WHERE slug = 'free';

-- 验证更新
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM subscription_plans
  WHERE features IS NOT NULL AND features != '{}'::jsonb;

  RAISE NOTICE '';
  RAISE NOTICE '已更新 % 个方案的 features 字段', updated_count;
  RAISE NOTICE '';
END $$;

-- 显示当前方案列表
SELECT
  slug AS 代号,
  name AS 名称,
  monthly_price / 100.0 AS 月价_元,
  yearly_price / 100.0 AS 年价_元,
  features->'display'->>'description' AS 描述,
  features->'resources'->>'credits_per_month' AS 月积分,
  CASE WHEN features IS NULL OR features = '{}'::jsonb THEN '❌ 缺失' ELSE '✓ 正常' END AS features状态
FROM subscription_plans
ORDER BY display_order DESC;

COMMIT;

-- 完成
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✓✓✓ Features 字段更新完成！';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：重启开发服务器';
  RAISE NOTICE '  bun run dev';
  RAISE NOTICE '';
END $$;
