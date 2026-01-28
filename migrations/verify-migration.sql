-- ============================================================================
-- 迁移验证脚本
--
-- 在执行迁移之后，运行此脚本验证数据完整性
--
-- 使用方法：
-- psql -d your_database < verify-migration.sql
-- ============================================================================

\echo '========================================='
\echo '开始验证数据库迁移...'
\echo '========================================='
\echo ''

-- ============================================================================
-- 验证 1: 检查表和字段是否存在
-- ============================================================================

\echo '验证 1: 检查表结构...'

-- 检查新表是否存在
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_orders')
    THEN '✓ payment_orders 表已创建'
    ELSE '✗ payment_orders 表不存在'
  END AS status
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_notifications')
    THEN '✓ payment_notifications 表已创建'
    ELSE '✗ payment_notifications 表不存在'
  END;

\echo ''

-- 检查 subscription_plans 新字段
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'monthly_price'
    )
    THEN '✓ subscription_plans.monthly_price 字段已添加'
    ELSE '✗ subscription_plans.monthly_price 字段不存在'
  END AS status
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'yearly_price'
    )
    THEN '✓ subscription_plans.yearly_price 字段已添加'
    ELSE '✗ subscription_plans.yearly_price 字段不存在'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'display_order'
    )
    THEN '✓ subscription_plans.display_order 字段已添加'
    ELSE '✗ subscription_plans.display_order 字段不存在'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'is_popular'
    )
    THEN '✓ subscription_plans.is_popular 字段已添加'
    ELSE '✗ subscription_plans.is_popular 字段不存在'
  END;

\echo ''

-- 检查旧字段是否已删除
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'interval'
    )
    THEN '✓ subscription_plans.interval 字段已删除'
    ELSE '⚠ subscription_plans.interval 字段仍然存在'
  END AS status
UNION ALL
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'price'
    )
    THEN '✓ subscription_plans.price 字段已删除'
    ELSE '⚠ subscription_plans.price 字段仍然存在'
  END;

\echo ''

-- 检查 user_extensions 新字段
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_extensions' AND column_name = 'billing_interval'
    )
    THEN '✓ user_extensions.billing_interval 字段已添加'
    ELSE '✗ user_extensions.billing_interval 字段不存在'
  END AS status
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_extensions' AND column_name = 'next_credit_grant_at'
    )
    THEN '✓ user_extensions.next_credit_grant_at 字段已添加'
    ELSE '✗ user_extensions.next_credit_grant_at 字段不存在'
  END;

-- ============================================================================
-- 验证 2: 检查数据完整性
-- ============================================================================

\echo ''
\echo '========================================='
\echo '验证 2: 检查数据完整性...'
\echo '========================================='
\echo ''

-- 检查方案数据
\echo '方案数据检查：'
SELECT
  COUNT(*) AS 方案总数,
  COUNT(*) FILTER (WHERE monthly_price IS NOT NULL) AS 有月价的方案数,
  COUNT(*) FILTER (WHERE yearly_price IS NOT NULL) AS 有年价的方案数,
  COUNT(*) FILTER (WHERE monthly_price IS NULL) AS 缺少月价的方案数
FROM subscription_plans;

\echo ''

-- 列出所有方案
\echo '当前方案列表：'
SELECT
  slug AS 方案代号,
  name AS 方案名称,
  CASE
    WHEN monthly_price IS NOT NULL THEN (monthly_price / 100.0)::TEXT || ' 元/月'
    ELSE '无'
  END AS 月价,
  CASE
    WHEN yearly_price IS NOT NULL THEN (yearly_price / 100.0)::TEXT || ' 元/年'
    ELSE '无'
  END AS 年价,
  display_order AS 排序,
  CASE WHEN is_popular THEN '是' ELSE '否' END AS 推荐,
  CASE WHEN is_active THEN '是' ELSE '否' END AS 启用
FROM subscription_plans
ORDER BY display_order DESC, monthly_price;

\echo ''

-- 检查用户数据
\echo '用户数据检查：'
SELECT
  COUNT(*) AS 用户总数,
  COUNT(*) FILTER (WHERE plan_id IS NOT NULL) AS 有方案的用户数,
  COUNT(*) FILTER (WHERE billing_interval IS NOT NULL) AS 有计费周期的用户数,
  COUNT(*) FILTER (WHERE current_plan != 'free' AND billing_interval IS NULL) AS 付费但缺计费周期的用户数
FROM user_extensions;

\echo ''

-- 用户订阅统计
\echo '用户订阅统计：'
SELECT
  current_plan AS 当前方案,
  billing_interval AS 计费周期,
  COUNT(*) AS 用户数,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) || '%' AS 占比
FROM user_extensions
WHERE current_plan IS NOT NULL
GROUP BY current_plan, billing_interval
ORDER BY 用户数 DESC;

-- ============================================================================
-- 验证 3: 检查外键完整性
-- ============================================================================

\echo ''
\echo '========================================='
\echo '验证 3: 检查外键完整性...'
\echo '========================================='
\echo ''

-- 检查 user_extensions 的 plan_id 是否都有效
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ 所有用户的 plan_id 都有效'
    ELSE '✗ 发现 ' || COUNT(*) || ' 个用户的 plan_id 无效'
  END AS status
FROM user_extensions ue
LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
WHERE ue.plan_id IS NOT NULL AND sp.id IS NULL;

\echo ''

-- 检查 user_subscription_history 的 plan_id 是否都有效
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ 所有订阅历史记录的 plan_id 都有效'
    ELSE '✗ 发现 ' || COUNT(*) || ' 条订阅历史记录的 plan_id 无效'
  END AS status
FROM user_subscription_history ush
LEFT JOIN subscription_plans sp ON ush.plan_id = sp.id
WHERE ush.plan_id IS NOT NULL AND sp.id IS NULL;

-- ============================================================================
-- 验证 4: 数据一致性检查
-- ============================================================================

\echo ''
\echo '========================================='
\echo '验证 4: 数据一致性检查...'
\echo '========================================='
\echo ''

-- 检查是否有方案缺少必需的价格
\echo '价格数据检查：'
SELECT
  slug AS 方案代号,
  name AS 方案名称,
  CASE
    WHEN monthly_price IS NULL THEN '✗ 缺少月价'
    WHEN monthly_price < 0 THEN '✗ 月价为负数'
    ELSE '✓ 月价正常'
  END AS 月价状态,
  CASE
    WHEN yearly_price IS NOT NULL AND yearly_price < monthly_price * 12 THEN '✓ 年付有优惠'
    WHEN yearly_price IS NOT NULL AND yearly_price >= monthly_price * 12 THEN '⚠ 年付无优惠'
    ELSE '- 不支持年付'
  END AS 年价状态
FROM subscription_plans
WHERE is_active = TRUE
ORDER BY monthly_price;

-- ============================================================================
-- 验证报告汇总
-- ============================================================================

\echo ''
\echo '========================================='
\echo '验证报告汇总'
\echo '========================================='
\echo ''

-- 汇总统计
WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM subscription_plans) AS total_plans,
    (SELECT COUNT(*) FROM subscription_plans WHERE monthly_price IS NULL) AS plans_missing_price,
    (SELECT COUNT(*) FROM user_extensions) AS total_users,
    (SELECT COUNT(*) FROM user_extensions WHERE plan_id IS NOT NULL) AS users_with_plan,
    (SELECT COUNT(*) FROM user_extensions ue
     LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
     WHERE ue.plan_id IS NOT NULL AND sp.id IS NULL) AS users_with_invalid_plan,
    (SELECT COUNT(*) FROM payment_orders) AS total_payment_orders,
    (SELECT COUNT(*) FROM payment_notifications) AS total_payment_notifications
)
SELECT
  '总方案数' AS 指标, total_plans::TEXT AS 数值 FROM stats
UNION ALL
SELECT '缺少价格的方案数', plans_missing_price::TEXT FROM stats
UNION ALL
SELECT '总用户数', total_users::TEXT FROM stats
UNION ALL
SELECT '有方案的用户数', users_with_plan::TEXT FROM stats
UNION ALL
SELECT '方案ID无效的用户数', users_with_invalid_plan::TEXT FROM stats
UNION ALL
SELECT '支付订单数', total_payment_orders::TEXT FROM stats
UNION ALL
SELECT '支付通知数', total_payment_notifications::TEXT FROM stats;

\echo ''

-- 最终结果
DO $$
DECLARE
  critical_issues INTEGER;
BEGIN
  -- 统计严重问题数量
  SELECT COUNT(*) INTO critical_issues FROM (
    -- 检查缺少月价的方案
    SELECT 1 FROM subscription_plans WHERE monthly_price IS NULL AND is_active = TRUE
    UNION ALL
    -- 检查无效的 plan_id
    SELECT 1 FROM user_extensions ue
    LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
    WHERE ue.plan_id IS NOT NULL AND sp.id IS NULL
    UNION ALL
    -- 检查付费用户缺少 billing_interval
    SELECT 1 FROM user_extensions
    WHERE current_plan != 'free' AND current_plan IS NOT NULL AND billing_interval IS NULL
  ) issues;

  IF critical_issues = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓✓✓ 验证通过！数据迁移成功！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '下一步：';
    RAISE NOTICE '1. 配置环境变量（.env）';
    RAISE NOTICE '2. 配置微信支付参数';
    RAISE NOTICE '3. 在测试环境测试支付流程';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '========================================';
    RAISE WARNING '⚠ 发现 % 个严重问题！', critical_issues;
    RAISE WARNING '请检查上述输出并修复问题';
    RAISE WARNING '========================================';
  END IF;
END $$;
