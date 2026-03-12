-- 为 user_extensions 表添加 next_plan_reason 字段
-- 记录系统为何设置 next_plan_id（到期降级 vs 支付失败降级）
ALTER TABLE user_extensions
  ADD COLUMN IF NOT EXISTS next_plan_reason TEXT;
