-- ============================================================================
-- 修复 user_subscription_history 表的 is_active 字段
--
-- 问题：每次续费创建新记录，但旧记录的 is_active 未标记为 false
-- 结果：一个用户可能有多条 is_active = true 的记录
-- 影响：Dashboard 统计活跃订阅数重复计算，MRR/ARR 计算错误
--
-- 修复策略：
-- 1. 每个用户只保留一条 is_active = true 的记录（最新的有效订阅）
-- 2. 标准：status = 'active' 且 ended_at 未过期（或为 NULL）
--
-- 执行前请务必备份数据库！
--
-- 使用方法：
-- psql -d your_database < fix-subscription-history-is-active.sql
--
-- 生成时间: 2026-02-05
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 查看当前问题规模
-- ----------------------------------------------------------------------------
SELECT
    '当前问题统计' as "检查项";

-- 统计每个用户有多少条 is_active = true 的记录
SELECT
    user_id,
    COUNT(*) as active_count,
    STRING_AGG(id::text, ', ') as record_ids
FROM user_subscription_history
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY active_count DESC
LIMIT 10;

-- 统计总问题数
SELECT
    COUNT(DISTINCT user_id) as "受影响用户数",
    SUM(active_count - 1) as "需要修复的记录数"
FROM (
    SELECT
        user_id,
        COUNT(*) as active_count
    FROM user_subscription_history
    WHERE is_active = true
    GROUP BY user_id
    HAVING COUNT(*) > 1
) subquery;

-- ----------------------------------------------------------------------------
-- 2. 修复策略：为每个用户确定哪条记录应该保持 is_active = true
-- ----------------------------------------------------------------------------

-- 创建临时表，记录每个用户应该保持激活的订阅记录
CREATE TEMP TABLE correct_active_subscriptions AS
SELECT DISTINCT ON (user_id)
    user_id,
    id as keep_active_id,
    status,
    started_at,
    ended_at
FROM user_subscription_history
WHERE
    -- 只考虑有效的订阅（未过期且状态为 active）
    status = 'active'
    AND (ended_at IS NULL OR ended_at > NOW())
ORDER BY
    user_id,
    created_at DESC,  -- 最新创建的记录优先
    started_at DESC;  -- 如果创建时间相同，按开始时间降序

-- 显示将要保留的记录
SELECT
    '将保留为 active 的记录' as "操作",
    COUNT(*) as "记录数"
FROM correct_active_subscriptions;

-- ----------------------------------------------------------------------------
-- 3. 执行修复
-- ----------------------------------------------------------------------------

-- 3a. 先将所有记录标记为 inactive
UPDATE user_subscription_history
SET
    is_active = false,
    updated_at = NOW()
WHERE is_active = true;

-- 3b. 将应该保持激活的记录恢复为 active
UPDATE user_subscription_history h
SET
    is_active = true,
    updated_at = NOW()
FROM correct_active_subscriptions c
WHERE h.id = c.keep_active_id;

-- ----------------------------------------------------------------------------
-- 4. 验证修复结果
-- ----------------------------------------------------------------------------

-- 4a. 检查是否还有用户有多条 is_active = true 的记录
SELECT
    '修复后检查：多条 active 记录的用户' as "检查项",
    COUNT(*) as "用户数"
FROM (
    SELECT user_id
    FROM user_subscription_history
    WHERE is_active = true
    GROUP BY user_id
    HAVING COUNT(*) > 1
) subquery;

-- 4b. 统计修复后的 is_active 状态
SELECT
    '修复后统计' as "检查项",
    is_active,
    COUNT(*) as record_count,
    COUNT(DISTINCT user_id) as user_count
FROM user_subscription_history
GROUP BY is_active
ORDER BY is_active DESC;

-- 4c. 显示每个用户的激活订阅
SELECT
    user_id,
    id,
    plan_name,
    status,
    started_at,
    ended_at,
    is_active
FROM user_subscription_history
WHERE is_active = true
ORDER BY user_id, created_at DESC
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 5. 清理临时表
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS correct_active_subscriptions;

COMMIT;

-- ============================================================================
-- 预期结果
-- ============================================================================
--
-- 修复前：
-- - 部分用户有多条 is_active = true 的记录
-- - Dashboard 统计的活跃订阅数偏高
-- - MRR/ARR 计算重复
--
-- 修复后：
-- - 每个用户最多只有一条 is_active = true 的记录
-- - 该记录是最新的、状态为 active、未过期的订阅
-- - 所有历史订阅记录保持 is_active = false
--
-- ============================================================================
-- 注意事项
-- ============================================================================
--
-- 1. 本脚本只处理 status = 'active' 的记录
--    - 如果用户的所有订阅都已过期或取消，则全部标记为 is_active = false
--    - 这是正确的行为，因为用户确实没有激活的订阅
--
-- 2. 如果需要手动回滚：
--    - 恢复数据库备份
--    - 或者根据业务逻辑重新确定 is_active 状态
--
-- 3. 后续预防：
--    - 代码已修复，每次创建新订阅记录时会自动标记旧记录为 inactive
--    - 定期运行此脚本检查数据一致性（应该不再有问题）
--
-- ============================================================================
