-- ============================================================================
-- 迁移状态检查脚本
--
-- 使用方法：在 pgAdmin 中直接执行此脚本
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '检查数据库迁移状态...';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE '=== 1. 表结构检查 ===';
END $$;

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'monthly_price')
    THEN '✓ subscription_plans.monthly_price 已存在'
    ELSE '✗ subscription_plans.monthly_price 不存在'
  END AS status
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'yearly_price')
    THEN '✓ subscription_plans.yearly_price 已存在'
    ELSE '✗ subscription_plans.yearly_price 不存在'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_orders')
    THEN '✓ payment_orders 表已存在'
    ELSE '✗ payment_orders 表不存在'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_notifications')
    THEN '✓ payment_notifications 表已存在'
    ELSE '✗ payment_notifications 表不存在'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_migrations')
    THEN '✓ plan_migrations 表已存在'
    ELSE '✗ plan_migrations 表不存在'
  END;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== 2. 方案数据检查 ===';
END $$;

-- 检查是否还有 interval 和 price 字段
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'interval')
    THEN '⚠ subscription_plans.interval 仍然存在（未完成迁移）'
    ELSE '✓ subscription_plans.interval 已删除（迁移完成）'
  END AS status
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'price')
    THEN '⚠ subscription_plans.price 仍然存在（未完成迁移）'
    ELSE '✓ subscription_plans.price 已删除（迁移完成）'
  END;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== 3. 方案数据统计 ===';
END $$;

SELECT
  slug,
  name,
  COALESCE(monthly_price / 100.0, 0) AS 月价,
  COALESCE(yearly_price / 100.0, 0) AS 年价,
  display_order AS 排序,
  is_popular AS 推荐,
  is_active AS 启用
FROM subscription_plans
ORDER BY display_order DESC;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== 4. 迁移记录检查 ===';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_migrations') THEN
    RAISE NOTICE '检查 plan_migrations 表内容...';
    PERFORM * FROM plan_migrations;
  ELSE
    RAISE NOTICE 'plan_migrations 表不存在';
  END IF;
END $$;

-- 如果 plan_migrations 表存在，显示其内容
SELECT * FROM plan_migrations
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_migrations');

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '检查完成';
  RAISE NOTICE '===========================================';
END $$;
