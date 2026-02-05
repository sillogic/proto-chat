-- ============================================================================
-- 检查表锁定和阻塞查询
-- ============================================================================

-- 1. 查看当前活动的查询
SELECT
    pid,
    usename,
    application_name,
    state,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    LEFT(query, 100) as query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
ORDER BY query_start;

-- 2. 查看被阻塞的查询
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement,
    blocked_activity.application_name AS blocked_application
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 3. 查看 payment_orders 表上的锁
SELECT
    l.locktype,
    l.mode,
    l.granted,
    a.query_start,
    a.state,
    a.usename,
    LEFT(a.query, 100) as query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
JOIN pg_class c ON l.relation = c.oid
WHERE c.relname = 'payment_orders';
