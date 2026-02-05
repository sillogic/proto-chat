-- ============================================================================
-- 添加套餐价值字段 - 修复残值计算缺陷
--
-- 问题：当前使用 amount (实付金额) 计算残值，但实付金额已经扣除了上一个套餐的
--       残值，导致后续升级时残值计算偏低。
--
-- 解决方案：添加 plan_value 字段记录套餐的标准价值（原价 - 促销优惠，但不扣除残值），
--          用于计算残值。
--
-- 执行前请务必备份数据库！
--
-- 使用方法：
-- psql -d your_database < add-plan-value-field.sql
--
-- 生成时间: 2026-02-05
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 添加 plan_value 字段到 payment_orders 表
-- ----------------------------------------------------------------------------

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS plan_value INTEGER;

-- 注释说明
COMMENT ON COLUMN payment_orders.plan_value IS
  '套餐标准价值（分）：原价 - 促销优惠（但不扣除残值）。用于计算残值。';

COMMENT ON COLUMN payment_orders.amount IS
  '实际支付金额（分）：原价 - 促销优惠 - 残值抵扣。';

-- ----------------------------------------------------------------------------
-- 数据回填：对于已有的订单，将 plan_value 设置为 amount
-- ----------------------------------------------------------------------------
-- 说明：对于历史订单，我们无法准确知道当时的 plan_value，
--      所以用 amount 作为近似值。虽然不完全准确，但比留空好。
--      这只影响历史订单，新订单会正确记录 plan_value。

UPDATE payment_orders
SET plan_value = amount
WHERE plan_value IS NULL;

-- ----------------------------------------------------------------------------
-- 验证数据
-- ----------------------------------------------------------------------------
-- 检查是否还有 NULL 值
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM payment_orders
  WHERE plan_value IS NULL;

  IF null_count > 0 THEN
    RAISE NOTICE '警告: 仍有 % 条订单的 plan_value 为 NULL', null_count;
  ELSE
    RAISE NOTICE '✓ 所有订单的 plan_value 都已设置';
  END IF;
END $$;

-- 显示迁移后的数据统计
SELECT
  status,
  COUNT(*) as count,
  AVG(amount::FLOAT / 100) as avg_amount_yuan,
  AVG(plan_value::FLOAT / 100) as avg_plan_value_yuan
FROM payment_orders
GROUP BY status;

COMMIT;

-- ============================================================================
-- 迁移完成
-- ============================================================================
