-- ============================================================================
-- 数据库备份脚本
--
-- 在执行迁移之前，请先运行此脚本备份关键表
--
-- 使用方法：
-- psql -d your_database < backup-database.sql
-- ============================================================================

\echo '========================================='
\echo '开始备份数据库...'
\echo '========================================='

-- 设置输出目录（请根据实际情况修改路径）
\set backup_dir '/tmp/db_backup_'`date +%Y%m%d_%H%M%S`

\echo '备份目录：' :backup_dir

-- 创建备份目录（需要在 psql 外部执行）
-- mkdir -p /tmp/db_backup_20260127_120000

-- ============================================================================
-- 备份关键表
-- ============================================================================

\echo ''
\echo '备份 subscription_plans 表...'
\copy subscription_plans TO '/tmp/subscription_plans_backup.csv' CSV HEADER;

\echo '备份 user_extensions 表...'
\copy user_extensions TO '/tmp/user_extensions_backup.csv' CSV HEADER;

\echo '备份 user_subscription_history 表...'
\copy user_subscription_history TO '/tmp/user_subscription_history_backup.csv' CSV HEADER;

\echo ''
\echo '========================================='
\echo '✓ 备份完成！'
\echo '========================================='
\echo ''
\echo '备份文件位置：'
\echo '  - /tmp/subscription_plans_backup.csv'
\echo '  - /tmp/user_extensions_backup.csv'
\echo '  - /tmp/user_subscription_history_backup.csv'
\echo ''
\echo '请妥善保管这些备份文件！'
\echo ''

-- ============================================================================
-- 备份前数据统计
-- ============================================================================

\echo '备份前数据统计：'
\echo ''

SELECT 'subscription_plans' AS 表名, COUNT(*) AS 记录数 FROM subscription_plans
UNION ALL
SELECT 'user_extensions', COUNT(*) FROM user_extensions
UNION ALL
SELECT 'user_subscription_history', COUNT(*) FROM user_subscription_history;

\echo ''
\echo '方案列表（备份前）：'
SELECT
  id,
  slug,
  name,
  interval,
  price / 100.0 AS price_yuan,
  is_active
FROM subscription_plans
ORDER BY slug, interval;
