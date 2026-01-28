-- ============================================================================
-- 微信支付集成 - 数据库迁移脚本
--
-- 执行前请务必备份数据库！
--
-- 使用方法：
-- 1. 在测试环境执行：psql -d your_database < wechat-pay-migration.sql
-- 2. 验证数据完整性
-- 3. 再在生产环境执行
--
-- 生成时间: 2026-01-27
-- ============================================================================

-- ============================================================================
-- PART 1: Schema 变更
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1.1 修改 subscription_plans 表
-- ----------------------------------------------------------------------------

-- 添加新字段（先添加，保留旧字段以便数据迁移）
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS monthly_price INTEGER,
  ADD COLUMN IF NOT EXISTS yearly_price INTEGER,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE NOT NULL;

-- 暂时保留 interval 和 price 字段，用于数据迁移

-- ----------------------------------------------------------------------------
-- 1.2 修改 user_extensions 表
-- ----------------------------------------------------------------------------

ALTER TABLE user_extensions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT,
  ADD COLUMN IF NOT EXISTS next_credit_grant_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 1.3 修改 user_subscription_history 表
-- ----------------------------------------------------------------------------

ALTER TABLE user_subscription_history
  ADD COLUMN IF NOT EXISTS order_no VARCHAR(64),
  ADD COLUMN IF NOT EXISTS billing_interval TEXT;

-- ----------------------------------------------------------------------------
-- 1.4 创建 payment_orders 表
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(64) UNIQUE NOT NULL,
  user_id TEXT NOT NULL,

  -- 订单内容
  plan_id TEXT NOT NULL,
  plan_interval VARCHAR(10) NOT NULL,  -- 'month' | 'year'
  amount INTEGER NOT NULL,              -- 支付金额(分)
  currency VARCHAR(10) DEFAULT 'CNY',

  -- 支付渠道
  pay_channel VARCHAR(20) NOT NULL,     -- 'wechat_native' | 'alipay'
  channel_order_no VARCHAR(128),        -- 渠道方订单号

  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | paid | closed | refunded
  channel_data JSONB,                   -- 渠道特有数据(code_url等)

  -- 时间
  expired_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);

-- ----------------------------------------------------------------------------
-- 1.5 创建 payment_notifications 表
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(64) NOT NULL,
  pay_channel VARCHAR(20) NOT NULL,
  raw_data TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,  -- success | fail | duplicate
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payment_notifications_order_no ON payment_notifications(order_no);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_created_at ON payment_notifications(created_at);

COMMIT;

-- ============================================================================
-- PART 2: 数据迁移 - 合并月付/年付方案
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 2.1 数据迁移前的准备工作
-- ----------------------------------------------------------------------------

-- 创建临时表记录方案映射关系
CREATE TEMP TABLE plan_migrations (
  old_monthly_id TEXT,
  old_yearly_id TEXT,
  new_plan_id TEXT,
  new_slug TEXT,
  monthly_price INTEGER,
  yearly_price INTEGER
);

-- ----------------------------------------------------------------------------
-- 2.2 识别需要合并的方案对
-- ----------------------------------------------------------------------------

-- 假设现有方案命名规则：lite-monthly, lite-yearly, pro-monthly, pro-yearly

-- Lite 方案
INSERT INTO plan_migrations (old_monthly_id, old_yearly_id, new_slug, monthly_price, yearly_price)
SELECT
  monthly.id AS old_monthly_id,
  yearly.id AS old_yearly_id,
  'lite' AS new_slug,
  monthly.price AS monthly_price,
  yearly.price AS yearly_price
FROM
  (SELECT id, price FROM subscription_plans WHERE slug LIKE 'lite%' AND interval = 'month') monthly
LEFT JOIN
  (SELECT id, price FROM subscription_plans WHERE slug LIKE 'lite%' AND interval = 'year') yearly
ON true
WHERE monthly.id IS NOT NULL;

-- Pro 方案
INSERT INTO plan_migrations (old_monthly_id, old_yearly_id, new_slug, monthly_price, yearly_price)
SELECT
  monthly.id AS old_monthly_id,
  yearly.id AS old_yearly_id,
  'pro' AS new_slug,
  monthly.price AS monthly_price,
  yearly.price AS yearly_price
FROM
  (SELECT id, price FROM subscription_plans WHERE slug LIKE 'pro%' AND interval = 'month') monthly
LEFT JOIN
  (SELECT id, price FROM subscription_plans WHERE slug LIKE 'pro%' AND interval = 'year') yearly
ON true
WHERE monthly.id IS NOT NULL;

-- Ultra 方案
INSERT INTO plan_migrations (old_monthly_id, old_yearly_id, new_slug, monthly_price, yearly_price)
SELECT
  monthly.id AS old_monthly_id,
  yearly.id AS old_yearly_id,
  'ultra' AS new_slug,
  monthly.price AS monthly_price,
  yearly.price AS yearly_price
FROM
  (SELECT id, price FROM subscription_plans WHERE slug LIKE 'ultra%' AND interval = 'month') monthly
LEFT JOIN
  (SELECT id, price FROM subscription_plans WHERE slug LIKE 'ultra%' AND interval = 'year') yearly
ON true
WHERE monthly.id IS NOT NULL;

-- Enterprise 方案
INSERT INTO plan_migrations (old_monthly_id, old_yearly_id, new_slug, monthly_price, yearly_price)
SELECT
  monthly.id AS old_monthly_id,
  yearly.id AS old_yearly_id,
  'enterprise' AS new_slug,
  monthly.price AS monthly_price,
  yearly.price AS yearly_price
FROM
  (SELECT id, price FROM subscription_plans WHERE slug LIKE 'enterprise%' AND interval = 'month') monthly
LEFT JOIN
  (SELECT id, price FROM subscription_plans WHERE slug LIKE 'enterprise%' AND interval = 'year') yearly
ON true
WHERE monthly.id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2.3 更新 subscription_plans 表（使用月付行，填充新字段）
-- ----------------------------------------------------------------------------

-- 更新月付行的新字段
UPDATE subscription_plans sp
SET
  monthly_price = pm.monthly_price,
  yearly_price = pm.yearly_price,
  slug = pm.new_slug
FROM plan_migrations pm
WHERE sp.id = pm.old_monthly_id;

-- 记录新的 plan_id（使用月付行的ID）
UPDATE plan_migrations
SET new_plan_id = old_monthly_id;

-- ----------------------------------------------------------------------------
-- 2.4 更新 user_extensions 中的外键引用
-- ----------------------------------------------------------------------------

-- 更新使用月付方案的用户（无需改动 plan_id）
-- 但需要设置 billing_interval
UPDATE user_extensions ue
SET billing_interval = 'month'
FROM plan_migrations pm
WHERE ue.plan_id = pm.old_monthly_id;

-- 更新使用年付方案的用户（需要改 plan_id 为月付行的ID）
UPDATE user_extensions ue
SET
  plan_id = pm.new_plan_id,
  billing_interval = 'year'
FROM plan_migrations pm
WHERE ue.plan_id = pm.old_yearly_id;

-- ----------------------------------------------------------------------------
-- 2.5 更新 user_subscription_history 中的外键引用
-- ----------------------------------------------------------------------------

-- 更新月付历史记录
UPDATE user_subscription_history ush
SET billing_interval = 'month'
FROM plan_migrations pm
WHERE ush.plan_id = pm.old_monthly_id;

-- 更新年付历史记录
UPDATE user_subscription_history ush
SET
  plan_id = pm.new_plan_id,
  billing_interval = 'year'
FROM plan_migrations pm
WHERE ush.plan_id = pm.old_yearly_id;

-- ----------------------------------------------------------------------------
-- 2.6 删除年付行（已经合并到月付行）
-- ----------------------------------------------------------------------------

DELETE FROM subscription_plans
WHERE id IN (SELECT old_yearly_id FROM plan_migrations WHERE old_yearly_id IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 2.7 删除旧字段（interval, price）
-- ----------------------------------------------------------------------------

ALTER TABLE subscription_plans
  DROP COLUMN IF EXISTS interval,
  DROP COLUMN IF EXISTS price;

COMMIT;

-- ============================================================================
-- PART 3: 处理 Free 方案
-- ============================================================================

BEGIN;

-- Free 方案不需要合并（没有年付版本），但需要填充新字段
UPDATE subscription_plans
SET
  monthly_price = 0,
  yearly_price = NULL,
  display_order = 0
WHERE slug = 'free' OR slug = 'free-trial';

COMMIT;

-- ============================================================================
-- PART 4: 数据验证
-- ============================================================================

-- 验证 1：检查所有方案都有 monthly_price
DO $$
DECLARE
  missing_price_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_price_count
  FROM subscription_plans
  WHERE monthly_price IS NULL;

  IF missing_price_count > 0 THEN
    RAISE EXCEPTION '发现 % 个方案缺少 monthly_price，请检查！', missing_price_count;
  ELSE
    RAISE NOTICE '✓ 所有方案都有 monthly_price';
  END IF;
END $$;

-- 验证 2：检查 user_extensions 的 plan_id 都有效
DO $$
DECLARE
  invalid_plan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_plan_count
  FROM user_extensions ue
  LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
  WHERE ue.plan_id IS NOT NULL AND sp.id IS NULL;

  IF invalid_plan_count > 0 THEN
    RAISE EXCEPTION '发现 % 个用户的 plan_id 无效，请检查！', invalid_plan_count;
  ELSE
    RAISE NOTICE '✓ 所有用户的 plan_id 都有效';
  END IF;
END $$;

-- 验证 3：检查付费用户都有 billing_interval
DO $$
DECLARE
  missing_interval_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_interval_count
  FROM user_extensions
  WHERE current_plan != 'free'
    AND current_plan IS NOT NULL
    AND billing_interval IS NULL;

  IF missing_interval_count > 0 THEN
    RAISE WARNING '发现 % 个付费用户缺少 billing_interval', missing_interval_count;
  ELSE
    RAISE NOTICE '✓ 所有付费用户都有 billing_interval';
  END IF;
END $$;

-- ============================================================================
-- PART 5: 输出迁移报告
-- ============================================================================

\echo '========================================='
\echo '迁移完成！以下是迁移报告：'
\echo '========================================='

-- 统计方案数量
SELECT
  '方案总数' AS 统计项,
  COUNT(*) AS 数量
FROM subscription_plans
UNION ALL
SELECT
  '支持年付的方案数',
  COUNT(*)
FROM subscription_plans
WHERE yearly_price IS NOT NULL
UNION ALL
SELECT
  '标记为推荐的方案数',
  COUNT(*)
FROM subscription_plans
WHERE is_popular = TRUE;

\echo ''
\echo '方案列表：'
SELECT
  slug AS 方案代号,
  name AS 方案名称,
  monthly_price / 100.0 AS 月价_元,
  CASE
    WHEN yearly_price IS NOT NULL THEN yearly_price / 100.0
    ELSE NULL
  END AS 年价_元,
  display_order AS 排序,
  is_popular AS 是否推荐
FROM subscription_plans
ORDER BY display_order DESC, monthly_price;

\echo ''
\echo '用户订阅统计：'
SELECT
  current_plan AS 当前方案,
  billing_interval AS 计费周期,
  COUNT(*) AS 用户数
FROM user_extensions
WHERE current_plan IS NOT NULL
GROUP BY current_plan, billing_interval
ORDER BY 用户数 DESC;

\echo ''
\echo '========================================='
\echo '✓ 数据库迁移完成！'
\echo '========================================='

-- ============================================================================
-- PART 6: 回滚脚本（如果迁移失败，使用此部分回滚）
-- ============================================================================

-- 请将以下内容保存为 rollback.sql，仅在迁移失败时使用

/*

BEGIN;

-- 恢复 interval 和 price 字段
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS interval plan_interval,
  ADD COLUMN IF NOT EXISTS price INTEGER;

-- 从备份恢复数据（需要提前备份）
-- COPY subscription_plans FROM '/path/to/backup/subscription_plans.csv' CSV HEADER;
-- COPY user_extensions FROM '/path/to/backup/user_extensions.csv' CSV HEADER;

-- 删除新表
DROP TABLE IF EXISTS payment_orders;
DROP TABLE IF EXISTS payment_notifications;

-- 删除新字段
ALTER TABLE subscription_plans
  DROP COLUMN IF EXISTS monthly_price,
  DROP COLUMN IF EXISTS yearly_price,
  DROP COLUMN IF EXISTS display_order,
  DROP COLUMN IF EXISTS is_popular;

ALTER TABLE user_extensions
  DROP COLUMN IF EXISTS billing_interval,
  DROP COLUMN IF EXISTS next_credit_grant_at;

ALTER TABLE user_subscription_history
  DROP COLUMN IF EXISTS order_no,
  DROP COLUMN IF EXISTS billing_interval;

COMMIT;

*/
