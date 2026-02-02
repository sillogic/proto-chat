-- Migration: Reset all non-Free users to Free plan
-- Date: 2026-01-30
-- Description: Reset all paid users back to Free plan for testing one-time payment feature
-- ⚠️ WARNING: This will remove all active subscriptions! Only use in development/testing!

-- ============================================
-- Backup current state (optional, comment out if not needed)
-- ============================================

-- Create backup table (uncomment to use)
-- CREATE TABLE IF NOT EXISTS user_extensions_backup_20260130 AS
-- SELECT * FROM user_extensions WHERE current_plan != 'free';

-- ============================================
-- Step 1: Reset user_extensions to Free plan
-- ============================================

UPDATE user_extensions
SET
    current_plan = 'free',
    plan_id = NULL,
    plan_expires_at = NULL,
    billing_interval = NULL,
    subscription_type = 'recurring',
    duration_months = NULL,
    next_credit_grant_at = NULL,
    next_plan_id = NULL,
    updated_at = NOW()
WHERE current_plan != 'free' OR current_plan IS NULL;

-- ============================================
-- Step 2: Mark subscription history as expired
-- ============================================

UPDATE user_subscription_history
SET
    status = 'expired',
    is_active = false,
    ended_at = NOW()
WHERE status = 'active'
  AND is_active = true
  AND (plan_type != 'free' OR slug != 'free');

-- ============================================
-- Step 3: Close all pending payment orders
-- ============================================

UPDATE payment_orders
SET
    status = 'closed',
    closed_at = NOW(),
    updated_at = NOW()
WHERE status = 'pending';

-- ============================================
-- Step 4: Reset user balances to Free plan credits (optional)
-- ============================================

-- Get the Free plan's default credits
-- Assuming Free plan has a default credit amount (adjust as needed)
-- If you want to reset credits, uncomment and adjust:

-- UPDATE user_balances
-- SET
--     balance = 1000,  -- Adjust this to Free plan's default credits
--     updated_at = NOW()
-- WHERE user_id IN (
--     SELECT user_id FROM user_extensions WHERE current_plan = 'free'
-- );

-- ============================================
-- Verification Queries
-- ============================================

-- Check how many users were reset
SELECT
    current_plan,
    subscription_type,
    COUNT(*) as user_count
FROM user_extensions
GROUP BY current_plan, subscription_type;

-- Check subscription history
SELECT
    status,
    is_active,
    COUNT(*) as count
FROM user_subscription_history
GROUP BY status, is_active;

-- Check payment orders
SELECT
    status,
    COUNT(*) as count
FROM payment_orders
GROUP BY status;

-- ============================================
-- Rollback (if needed)
-- ============================================

-- To restore from backup (uncomment if you created backup):
-- UPDATE user_extensions ue
-- SET
--     current_plan = b.current_plan,
--     plan_id = b.plan_id,
--     plan_expires_at = b.plan_expires_at,
--     billing_interval = b.billing_interval,
--     subscription_type = b.subscription_type,
--     duration_months = b.duration_months,
--     next_credit_grant_at = b.next_credit_grant_at,
--     next_plan_id = b.next_plan_id
-- FROM user_extensions_backup_20260130 b
-- WHERE ue.user_id = b.user_id;
