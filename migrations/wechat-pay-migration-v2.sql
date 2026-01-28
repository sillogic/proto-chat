-- ============================================================================
-- 微信支付集成 - 数据库迁移脚本 V2（幂等版本）
--
-- 版本：v2.0
-- 特性：可以安全地重复执行，不会报错，适用于 pgAdmin 图形化工具
-- 生成时间：2026-01-27
--
-- 使用方法：在 pgAdmin 中直接执行此脚本
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '开始执行微信支付数据库迁移（幂等版本）...';
  RAISE NOTICE '===========================================';
END $$;

BEGIN;

-- ============================================================================
-- Part 1: Schema Changes（使用幂等操作）
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Part 1: 执行数据库结构变更...';
END $$;

-- 1.1 修改 subscription_plans 表
DO $$
BEGIN
  -- 添加新字段（如果不存在）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'monthly_price') THEN
    ALTER TABLE subscription_plans ADD COLUMN monthly_price INTEGER;
    RAISE NOTICE '✓ 添加 monthly_price 字段';
  ELSE
    RAISE NOTICE '⊙ monthly_price 字段已存在，跳过';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'yearly_price') THEN
    ALTER TABLE subscription_plans ADD COLUMN yearly_price INTEGER;
    RAISE NOTICE '✓ 添加 yearly_price 字段';
  ELSE
    RAISE NOTICE '⊙ yearly_price 字段已存在，跳过';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'display_order') THEN
    ALTER TABLE subscription_plans ADD COLUMN display_order INTEGER DEFAULT 0 NOT NULL;
    RAISE NOTICE '✓ 添加 display_order 字段';
  ELSE
    RAISE NOTICE '⊙ display_order 字段已存在，跳过';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'is_popular') THEN
    ALTER TABLE subscription_plans ADD COLUMN is_popular BOOLEAN DEFAULT FALSE NOT NULL;
    RAISE NOTICE '✓ 添加 is_popular 字段';
  ELSE
    RAISE NOTICE '⊙ is_popular 字段已存在，跳过';
  END IF;
END $$;

-- 1.2 修改 user_extensions 表
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_extensions' AND column_name = 'billing_interval') THEN
    ALTER TABLE user_extensions ADD COLUMN billing_interval VARCHAR(10);
    RAISE NOTICE '✓ 添加 user_extensions.billing_interval 字段';
  ELSE
    RAISE NOTICE '⊙ user_extensions.billing_interval 字段已存在，跳过';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_extensions' AND column_name = 'next_credit_grant_at') THEN
    ALTER TABLE user_extensions ADD COLUMN next_credit_grant_at TIMESTAMP;
    RAISE NOTICE '✓ 添加 next_credit_grant_at 字段';
  ELSE
    RAISE NOTICE '⊙ next_credit_grant_at 字段已存在，跳过';
  END IF;
END $$;

-- 1.3 修改 user_subscription_history 表
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_subscription_history' AND column_name = 'order_no') THEN
    ALTER TABLE user_subscription_history ADD COLUMN order_no VARCHAR(64);
    RAISE NOTICE '✓ 添加 user_subscription_history.order_no 字段';
  ELSE
    RAISE NOTICE '⊙ user_subscription_history.order_no 字段已存在，跳过';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_subscription_history' AND column_name = 'billing_interval') THEN
    ALTER TABLE user_subscription_history ADD COLUMN billing_interval VARCHAR(10);
    RAISE NOTICE '✓ 添加 user_subscription_history.billing_interval 字段';
  ELSE
    RAISE NOTICE '⊙ user_subscription_history.billing_interval 字段已存在，跳过';
  END IF;
END $$;

-- 1.4 创建支付订单表（幂等）
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(64) UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_interval VARCHAR(10) NOT NULL,
  amount INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_channel VARCHAR(20) NOT NULL,
  payment_data JSONB,
  qr_code_url TEXT,
  expires_at TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 创建索引（幂等）
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);

DO $$
BEGIN
  RAISE NOTICE '✓ payment_orders 表已就绪';
END $$;

-- 1.5 创建支付通知表（幂等）
CREATE TABLE IF NOT EXISTS payment_notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(64) NOT NULL,
  notification_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_notifications_order_no ON payment_notifications(order_no);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_created_at ON payment_notifications(created_at);

DO $$
BEGIN
  RAISE NOTICE '✓ payment_notifications 表已就绪';
END $$;

-- 1.6 创建迁移记录表（幂等）
CREATE TABLE IF NOT EXISTS plan_migrations (
  old_id TEXT,
  old_slug VARCHAR(50),
  old_interval VARCHAR(10),
  old_price INTEGER,
  new_id TEXT,
  new_slug VARCHAR(50),
  migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  RAISE NOTICE '✓ plan_migrations 表已就绪';
END $$;

-- ============================================================================
-- Part 2: Data Migration（检查是否需要迁移）
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Part 2: 执行数据迁移...';
END $$;

DO $$
DECLARE
  needs_migration BOOLEAN;
  old_plan_count INTEGER;
BEGIN
  -- 检查是否需要数据迁移
  -- 如果存在 interval 和 price 字段，且新字段为空，则需要迁移
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'interval'
  ) INTO needs_migration;

  IF needs_migration THEN
    -- 统计旧方案数量
    EXECUTE 'SELECT COUNT(*) FROM subscription_plans WHERE interval IS NOT NULL' INTO old_plan_count;

    IF old_plan_count > 0 THEN
      RAISE NOTICE '检测到 % 条旧方案数据，开始迁移...', old_plan_count;

      -- 2.1 迁移月付方案的数据
      INSERT INTO plan_migrations (old_id, old_slug, old_interval, old_price, new_id, new_slug)
      SELECT
        id AS old_id,
        slug AS old_slug,
        interval AS old_interval,
        price AS old_price,
        id AS new_id,
        slug AS new_slug
      FROM subscription_plans
      WHERE interval = 'month'
      ON CONFLICT DO NOTHING;

      -- 更新 monthly_price
      EXECUTE $sql$
        UPDATE subscription_plans
        SET monthly_price = price
        WHERE interval = 'month' AND monthly_price IS NULL
      $sql$;

      -- 2.2 处理年付方案
      EXECUTE $sql$
        UPDATE subscription_plans sp_month
        SET yearly_price = sp_year.price
        FROM subscription_plans sp_year
        WHERE sp_year.slug = sp_month.slug
          AND sp_year.interval = 'year'
          AND sp_month.interval = 'month'
          AND sp_month.yearly_price IS NULL
      $sql$;

      -- 记录年付方案的迁移
      INSERT INTO plan_migrations (old_id, old_slug, old_interval, old_price, new_id, new_slug)
      SELECT
        sp_year.id AS old_id,
        sp_year.slug AS old_slug,
        'year' AS old_interval,
        sp_year.price AS old_price,
        sp_month.id AS new_id,
        sp_month.slug AS new_slug
      FROM subscription_plans sp_year
      JOIN subscription_plans sp_month ON sp_year.slug = sp_month.slug AND sp_month.interval = 'month'
      WHERE sp_year.interval = 'year'
      ON CONFLICT DO NOTHING;

      -- 2.3 迁移用户数据
      EXECUTE $sql$
        UPDATE user_extensions ue
        SET
          plan_id = (
            SELECT id FROM subscription_plans
            WHERE slug = ue.current_plan AND interval = 'month'
            LIMIT 1
          ),
          billing_interval = 'month'
        WHERE current_plan IN (SELECT slug FROM subscription_plans WHERE interval = 'month')
          AND plan_id IS NULL
      $sql$;

      -- 2.4 迁移订阅历史
      EXECUTE $sql$
        UPDATE user_subscription_history ush
        SET
          plan_id = (
            SELECT id FROM subscription_plans
            WHERE slug = ush.plan_slug
            LIMIT 1
          ),
          billing_interval = 'month'
        WHERE plan_id IS NULL AND plan_slug IS NOT NULL
      $sql$;

      -- 2.5 设置 display_order
      EXECUTE $sql$
        UPDATE subscription_plans
        SET display_order = CASE slug
          WHEN 'elite' THEN 30
          WHEN 'premium' THEN 20
          WHEN 'lite' THEN 10
          ELSE 0
        END
        WHERE display_order = 0
      $sql$;

      -- 2.6 设置推荐方案
      EXECUTE $sql$
        UPDATE subscription_plans
        SET is_popular = TRUE
        WHERE slug = 'premium' AND interval = 'month'
      $sql$;

      -- 2.7 删除年付的重复记录
      EXECUTE $sql$
        DELETE FROM subscription_plans
        WHERE interval = 'year'
      $sql$;

      RAISE NOTICE '✓ 数据迁移完成';
    ELSE
      RAISE NOTICE '⊙ 未检测到需要迁移的旧数据';
    END IF;
  ELSE
    RAISE NOTICE '⊙ 数据库已使用新结构，无需迁移数据';
  END IF;
END $$;

-- ============================================================================
-- Part 3: Handle Free Plan（幂等处理）
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Part 3: 处理免费方案...';
END $$;

DO $$
DECLARE
  free_plan_exists BOOLEAN;
BEGIN
  -- 检查是否存在 free 方案
  SELECT EXISTS (
    SELECT 1 FROM subscription_plans WHERE slug = 'free'
  ) INTO free_plan_exists;

  IF free_plan_exists THEN
    -- 如果存在 interval 字段，检查是否有多个 free 方案
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'interval') THEN
      -- 保留第一个，删除其他的
      EXECUTE $sql$
        DELETE FROM subscription_plans
        WHERE slug = 'free' AND id NOT IN (
          SELECT id FROM subscription_plans WHERE slug = 'free' ORDER BY created_at LIMIT 1
        )
      $sql$;
    END IF;

    -- 确保 free 方案的价格字段正确
    UPDATE subscription_plans
    SET
      monthly_price = COALESCE(monthly_price, 0),
      yearly_price = NULL,
      display_order = COALESCE(NULLIF(display_order, 0), 0),
      is_active = TRUE
    WHERE slug = 'free';

    RAISE NOTICE '✓ 免费方案已处理';
  ELSE
    RAISE NOTICE '⊙ 未找到免费方案';
  END IF;
END $$;

-- ============================================================================
-- Part 4: Cleanup Old Fields（仅在确认迁移完成后删除）
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Part 4: 清理旧字段...';
END $$;

DO $$
DECLARE
  has_old_fields BOOLEAN;
  unmigrated_count INTEGER;
BEGIN
  -- 检查是否存在旧字段
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'interval'
  ) INTO has_old_fields;

  IF has_old_fields THEN
    -- 检查是否还有未迁移的数据
    EXECUTE 'SELECT COUNT(*) FROM subscription_plans WHERE monthly_price IS NULL AND interval IS NOT NULL'
    INTO unmigrated_count;

    IF unmigrated_count = 0 THEN
      -- 安全删除旧字段
      ALTER TABLE subscription_plans DROP COLUMN IF EXISTS interval;
      ALTER TABLE subscription_plans DROP COLUMN IF EXISTS price;
      RAISE NOTICE '✓ 已删除旧字段 interval 和 price';
    ELSE
      RAISE WARNING '⚠ 还有 % 条数据未迁移，保留旧字段', unmigrated_count;
    END IF;
  ELSE
    RAISE NOTICE '⊙ 旧字段已删除，无需清理';
  END IF;
END $$;

-- ============================================================================
-- Part 5: Validation（验证迁移结果）
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Part 5: 验证迁移结果...';
END $$;

DO $$
DECLARE
  total_plans INTEGER;
  plans_with_monthly INTEGER;
  invalid_plan_refs INTEGER;
BEGIN
  -- 统计方案
  SELECT COUNT(*) INTO total_plans FROM subscription_plans;
  SELECT COUNT(*) INTO plans_with_monthly FROM subscription_plans WHERE monthly_price IS NOT NULL;

  -- 检查无效引用
  SELECT COUNT(*) INTO invalid_plan_refs
  FROM user_extensions ue
  LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
  WHERE ue.plan_id IS NOT NULL AND sp.id IS NULL;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE '验证结果：';
  RAISE NOTICE '- 总方案数: %', total_plans;
  RAISE NOTICE '- 有月价的方案数: %', plans_with_monthly;
  RAISE NOTICE '- 无效的用户方案引用: %', invalid_plan_refs;
  RAISE NOTICE '----------------------------------------';

  IF invalid_plan_refs > 0 THEN
    RAISE WARNING '⚠ 发现无效的方案引用，请检查';
  END IF;
END $$;

-- 显示当前方案列表
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '当前方案列表：';
END $$;

SELECT
  slug AS 代号,
  name AS 名称,
  COALESCE(monthly_price / 100.0, 0) AS 月价_元,
  COALESCE(yearly_price / 100.0, 0) AS 年价_元,
  display_order AS 排序,
  CASE WHEN is_popular THEN '是' ELSE '否' END AS 推荐,
  CASE WHEN is_active THEN '是' ELSE '否' END AS 启用
FROM subscription_plans
ORDER BY display_order DESC;

-- ============================================================================
-- Commit Transaction
-- ============================================================================

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✓✓✓ 迁移完成！';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 运行 verify-migration.sql 进行完整验证';
  RAISE NOTICE '2. 配置环境变量（.env.wechat-pay.example）';
  RAISE NOTICE '3. 测试支付流程';
END $$;
