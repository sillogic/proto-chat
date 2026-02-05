-- ============================================================================
-- 检查 plan_value 字段是否存在
-- ============================================================================

-- 检查 payment_orders 表是否有 plan_value 字段
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_orders'
  AND column_name = 'plan_value';

-- 如果返回空，说明字段不存在，需要执行迁移脚本
-- 如果返回一行数据，说明字段已存在

-- 也可以直接查询表结构
\d payment_orders;
