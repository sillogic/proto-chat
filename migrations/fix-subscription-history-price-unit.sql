-- ============================================================================
-- 修复订阅历史记录价格单位不一致问题
--
-- 问题：user_subscription_history.price 字段存在单位不一致
--       - 有些记录存的是"元"（如149元存为149）
--       - 有些记录存的是"分"（如149元存为14900）
--
-- 解决方案：统一转换为"分"为单位
--
-- 执行前请务必备份数据库！
--
-- 使用方法：
-- psql -d your_database < fix-subscription-history-price-unit.sql
--
-- 生成时间: 2026-02-05
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 第1步：分析现有数据，识别单位
-- ----------------------------------------------------------------------------
-- 假设：价格小于1000的记录可能是"元"为单位（需要 *100）
--      价格大于等于1000的记录是"分"为单位（保持不变）

-- 查看数据分布（仅供参考，不执行修改）
DO $$
DECLARE
  small_price_count INTEGER;
  large_price_count INTEGER;
BEGIN
  -- 价格 < 1000 的记录数
  SELECT COUNT(*) INTO small_price_count
  FROM user_subscription_history
  WHERE price > 0 AND price < 1000;

  -- 价格 >= 1000 的记录数
  SELECT COUNT(*) INTO large_price_count
  FROM user_subscription_history
  WHERE price >= 1000;

  RAISE NOTICE '==== 数据分析 ====';
  RAISE NOTICE '价格 < 1000 的记录数（可能是"元"）: %', small_price_count;
  RAISE NOTICE '价格 >= 1000 的记录数（应该是"分"）: %', large_price_count;
  RAISE NOTICE '';
END $$;

-- 显示需要转换的样本数据（价格 < 1000）
SELECT
  id,
  user_id,
  plan_name,
  price as "当前价格",
  price * 100 as "转换后价格(分)",
  started_at
FROM user_subscription_history
WHERE price > 0 AND price < 1000
ORDER BY started_at DESC
LIMIT 10;

-- ----------------------------------------------------------------------------
-- 第2步：执行转换（谨慎操作！）
-- ----------------------------------------------------------------------------
-- 将价格 < 1000 的记录转换为"分"（乘以100）

UPDATE user_subscription_history
SET
  price = price * 100,
  updated_at = NOW()
WHERE price > 0 AND price < 1000;

-- 记录更新的记录数
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '';
  RAISE NOTICE '==== 转换完成 ====';
  RAISE NOTICE '已更新 % 条记录', updated_count;
END $$;

-- ----------------------------------------------------------------------------
-- 第3步：验证转换结果
-- ----------------------------------------------------------------------------

-- 检查是否还有小于1000的价格（除了0）
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM user_subscription_history
  WHERE price > 0 AND price < 1000;

  IF remaining_count > 0 THEN
    RAISE WARNING '警告: 仍有 % 条记录的价格 < 1000', remaining_count;
  ELSE
    RAISE NOTICE '✓ 所有非零价格都 >= 1000（单位统一为"分"）';
  END IF;
END $$;

-- 显示转换后的价格分布
SELECT
  CASE
    WHEN price = 0 THEN '0 (免费)'
    WHEN price < 10000 THEN '< 100元'
    WHEN price < 50000 THEN '100-500元'
    WHEN price < 100000 THEN '500-1000元'
    ELSE '>= 1000元'
  END as "价格区间",
  COUNT(*) as "记录数",
  MIN(price) as "最小值(分)",
  MAX(price) as "最大值(分)"
FROM user_subscription_history
GROUP BY
  CASE
    WHEN price = 0 THEN '0 (免费)'
    WHEN price < 10000 THEN '< 100元'
    WHEN price < 50000 THEN '100-500元'
    WHEN price < 100000 THEN '500-1000元'
    ELSE '>= 1000元'
  END
ORDER BY MIN(price);

COMMIT;

-- ============================================================================
-- 迁移完成
--
-- 注意事项：
-- 1. 此脚本假设价格 < 1000 的记录是"元"为单位，需要乘以100
-- 2. 如果你的数据中有合法的小额订阅（如10元/月），请调整阈值
-- 3. 建议先在测试环境执行，验证结果后再在生产环境执行
-- 4. 执行后，前端显示时需要除以100转换为"元"
-- ============================================================================
