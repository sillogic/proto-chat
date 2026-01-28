-- ============================================================================
-- 完整更新订阅方案数据（价格 + Features）
--
-- 根据原有硬编码截图数据更新
-- 使用方法：在 pgAdmin 中直接执行此脚本
-- ============================================================================

BEGIN;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '开始更新订阅方案数据...';
  RAISE NOTICE '===========================================';
END $$;

-- ============================================================================
-- Lite 方案
-- ============================================================================
UPDATE subscription_plans
SET
  name = 'Lite',
  monthly_price = 14900,  -- ¥149/月
  yearly_price = 142800,  -- ¥1428/年（年付月价 ¥119 × 12）
  display_order = 10,
  is_popular = false,
  credits = '5000000',  -- 5,000,000 积分/月
  storage_limit = 1024,  -- 1.0 GB
  vector_limit = 5000,  -- 5,000 条
  features = '{
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

-- ============================================================================
-- Pro 方案（最多选择）
-- ============================================================================
UPDATE subscription_plans
SET
  name = 'Pro',
  monthly_price = 29900,  -- ¥299/月
  yearly_price = 286800,  -- ¥2868/年（年付月价 ¥239 × 12）
  display_order = 20,
  is_popular = true,  -- 最多选择标签
  credits = '15000000',  -- 15,000,000 积分/月
  storage_limit = 2048,  -- 2.0 GB
  vector_limit = 10000,  -- 10,000 条
  features = '{
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

-- ============================================================================
-- Ultra 方案
-- ============================================================================
UPDATE subscription_plans
SET
  name = 'Ultra',
  monthly_price = 59900,  -- ¥599/月
  yearly_price = 574800,  -- ¥5748/年（年付月价 ¥479 × 12）
  display_order = 30,
  is_popular = false,
  credits = '35000000',  -- 35,000,000 积分/月
  storage_limit = 4096,  -- 4.0 GB
  vector_limit = 20000,  -- 20,000 条
  features = '{
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

-- ============================================================================
-- Free 方案（如果存在）
-- ============================================================================
UPDATE subscription_plans
SET
  name = 'Free',
  monthly_price = 0,
  yearly_price = NULL,
  display_order = 0,
  is_popular = false,
  credits = '350000',  -- 350,000 积分/月
  storage_limit = 512,  -- 0.5 GB
  vector_limit = 1000,  -- 1,000 条
  features = '{
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

-- ============================================================================
-- 验证更新结果
-- ============================================================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM subscription_plans
  WHERE features IS NOT NULL AND features != '{}'::jsonb;

  RAISE NOTICE '';
  RAISE NOTICE '✓ 已更新 % 个方案', updated_count;
  RAISE NOTICE '';
END $$;

-- 显示更新后的方案列表
DO $$
BEGIN
  RAISE NOTICE '当前方案列表：';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  slug AS 代号,
  name AS 名称,
  monthly_price / 100.0 AS 月价_元,
  yearly_price / 100.0 AS 年价_元,
  ROUND((1 - yearly_price::numeric / (monthly_price * 12)) * 100, 0)::TEXT || '%' AS 年付优惠,
  credits AS 月积分,
  storage_limit AS 文件存储MB,
  vector_limit AS 向量存储条数,
  CASE WHEN is_popular THEN '✓' ELSE '-' END AS 推荐,
  features->'display'->>'description' AS 描述,
  CASE WHEN features IS NULL OR features = '{}'::jsonb THEN '❌ 缺失' ELSE '✓ 正常' END AS features状态
FROM subscription_plans
WHERE is_active = true
ORDER BY display_order DESC;

COMMIT;

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✓✓✓ 订阅方案数据更新完成！';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE '数据说明：';
  RAISE NOTICE '- Lite: ¥149/月, ¥1428/年 (年付月价 ¥119)';
  RAISE NOTICE '- Pro: ¥299/月, ¥2868/年 (年付月价 ¥239) [最多选择]';
  RAISE NOTICE '- Ultra: ¥599/月, ¥5748/年 (年付月价 ¥479)';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 重启开发服务器: bun run dev';
  RAISE NOTICE '2. 访问: http://localhost:3010/subscription/plans';
  RAISE NOTICE '3. 检查页面显示是否和截图一致';
  RAISE NOTICE '';
END $$;
