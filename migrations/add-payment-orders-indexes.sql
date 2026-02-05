-- ============================================================================
-- 为 payment_orders 表添加性能优化索引
--
-- 问题：后台系统支付订单列表查询超时
-- 原因：缺少索引导致全表扫描
--
-- 执行前请务必备份数据库！
--
-- 使用方法：
-- psql -d your_database < add-payment-orders-indexes.sql
--
-- 生成时间: 2026-02-05
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 检查现有索引
-- ----------------------------------------------------------------------------
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'payment_orders';

-- ----------------------------------------------------------------------------
-- 2. 添加索引（使用 IF NOT EXISTS 避免重复创建）
-- ----------------------------------------------------------------------------

-- 用户ID索引（用于 JOIN users 和按用户过滤）
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id
ON payment_orders(user_id);

-- 套餐ID索引（用于 JOIN subscription_plans）
CREATE INDEX IF NOT EXISTS idx_payment_orders_plan_id
ON payment_orders(plan_id);

-- 订单状态索引（用于 WHERE status = ? 过滤）
CREATE INDEX IF NOT EXISTS idx_payment_orders_status
ON payment_orders(status);

-- 支付渠道索引（用于 WHERE pay_channel = ? 过滤）
CREATE INDEX IF NOT EXISTS idx_payment_orders_pay_channel
ON payment_orders(pay_channel);

-- 创建时间索引（用于 ORDER BY created_at DESC）
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at
ON payment_orders(created_at DESC);

-- 组合索引：状态 + 创建时间（优化常见查询：按状态过滤并按时间排序）
CREATE INDEX IF NOT EXISTS idx_payment_orders_status_created_at
ON payment_orders(status, created_at DESC);

-- 组合索引：用户ID + 状态 + 创建时间（优化按用户查询订单历史）
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_status_created
ON payment_orders(user_id, status, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. 验证索引创建
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  -- 统计 payment_orders 表的索引数量
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'payment_orders';

  RAISE NOTICE '';
  RAISE NOTICE '==== 索引创建完成 ====';
  RAISE NOTICE 'payment_orders 表当前索引数量: %', index_count;
  RAISE NOTICE '';
END $$;

-- 显示所有索引
SELECT
    indexname as "索引名称",
    indexdef as "索引定义"
FROM pg_indexes
WHERE tablename = 'payment_orders'
ORDER BY indexname;

-- ----------------------------------------------------------------------------
-- 4. 分析表（更新统计信息，优化查询计划）
-- ----------------------------------------------------------------------------
ANALYZE payment_orders;

COMMIT;

-- ============================================================================
-- 索引说明
-- ============================================================================
--
-- 1. idx_payment_orders_user_id
--    优化：LEFT JOIN users u ON po.user_id = u.id
--    优化：WHERE user_id = ?
--
-- 2. idx_payment_orders_plan_id
--    优化：LEFT JOIN subscription_plans sp ON po.plan_id = sp.id
--
-- 3. idx_payment_orders_status
--    优化：WHERE status = 'paid'
--
-- 4. idx_payment_orders_pay_channel
--    优化：WHERE pay_channel = 'alipay_precreate'
--
-- 5. idx_payment_orders_created_at
--    优化：ORDER BY created_at DESC
--
-- 6. idx_payment_orders_status_created_at (组合索引)
--    优化：WHERE status = ? ORDER BY created_at DESC
--    覆盖查询：SELECT * FROM payment_orders WHERE status = 'paid' ORDER BY created_at DESC
--
-- 7. idx_payment_orders_user_status_created (组合索引)
--    优化：WHERE user_id = ? AND status = ? ORDER BY created_at DESC
--    用于用户订单历史查询
--
-- ============================================================================
-- 性能提升预期
-- ============================================================================
--
-- 假设 payment_orders 表有 10,000 条记录：
--
-- 无索引：
-- - 全表扫描：~100-500ms
-- - 多表 JOIN：~500-2000ms
-- - 可能导致超时
--
-- 有索引：
-- - 索引查找：~1-10ms
-- - 多表 JOIN：~10-50ms
-- - 查询速度提升 10-100 倍
--
-- ============================================================================
