-- Migration: Add one-time payment support
-- Date: 2026-01-30
-- Description: Add subscription_type and duration_months fields to support three payment modes:
--   1. recurring + billingInterval='month' - 月订阅
--   2. recurring + billingInterval='year' - 年订阅
--   3. onetime + duration_months=1/3/6/12 - 一次性付费

-- ============================================
-- Step 1: Add fields to user_extensions table
-- ============================================

-- Add subscription_type field (default 'recurring' for existing users)
ALTER TABLE user_extensions
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'recurring'
CHECK (subscription_type IN ('recurring', 'onetime'));

-- Add duration_months field (NULL for recurring subscriptions)
ALTER TABLE user_extensions
ADD COLUMN IF NOT EXISTS duration_months INTEGER
CHECK (duration_months IS NULL OR duration_months IN (1, 3, 6, 12));

-- Add comment
COMMENT ON COLUMN user_extensions.subscription_type IS 'Subscription type: recurring (auto-renew) or onetime (one-time payment)';
COMMENT ON COLUMN user_extensions.duration_months IS 'Duration in months for one-time payments (1/3/6/12), NULL for recurring subscriptions';

-- ============================================
-- Step 2: Add fields to user_subscription_history table
-- ============================================

-- Add subscription_type field
ALTER TABLE user_subscription_history
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'recurring'
CHECK (subscription_type IN ('recurring', 'onetime'));

-- Add duration_months field
ALTER TABLE user_subscription_history
ADD COLUMN IF NOT EXISTS duration_months INTEGER
CHECK (duration_months IS NULL OR duration_months IN (1, 3, 6, 12));

-- Add comment
COMMENT ON COLUMN user_subscription_history.subscription_type IS 'Subscription type: recurring or onetime';
COMMENT ON COLUMN user_subscription_history.duration_months IS 'Duration in months for one-time payments (1/3/6/12)';

-- ============================================
-- Step 3: Add fields to payment_orders table
-- ============================================

-- Add subscription_type field
ALTER TABLE payment_orders
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'recurring'
CHECK (subscription_type IN ('recurring', 'onetime'));

-- Add duration_months field
ALTER TABLE payment_orders
ADD COLUMN IF NOT EXISTS duration_months INTEGER
CHECK (duration_months IS NULL OR duration_months IN (1, 3, 6, 12));

-- Add comment
COMMENT ON COLUMN payment_orders.subscription_type IS 'Subscription type: recurring or onetime';
COMMENT ON COLUMN payment_orders.duration_months IS 'Duration in months for one-time payments (1/3/6/12)';

-- ============================================
-- Step 4: Update existing data
-- ============================================

-- Set existing subscriptions as recurring
UPDATE user_extensions
SET subscription_type = 'recurring',
    duration_months = NULL
WHERE subscription_type IS NULL OR subscription_type = '';

UPDATE user_subscription_history
SET subscription_type = 'recurring',
    duration_months = NULL
WHERE subscription_type IS NULL OR subscription_type = '';

UPDATE payment_orders
SET subscription_type = 'recurring',
    duration_months = NULL
WHERE subscription_type IS NULL OR subscription_type = '';

-- ============================================
-- Step 5: Create indexes for better query performance
-- ============================================

-- Index for querying by subscription type
CREATE INDEX IF NOT EXISTS idx_user_extensions_subscription_type
ON user_extensions(subscription_type);

CREATE INDEX IF NOT EXISTS idx_user_subscription_history_subscription_type
ON user_subscription_history(subscription_type);

-- Composite index for subscription type + duration
CREATE INDEX IF NOT EXISTS idx_user_extensions_subscription_info
ON user_extensions(user_id, subscription_type, duration_months);

-- ============================================
-- Verification Queries
-- ============================================

-- Check the changes (uncomment to run)
-- SELECT subscription_type, duration_months, COUNT(*)
-- FROM user_extensions
-- GROUP BY subscription_type, duration_months;

-- SELECT subscription_type, duration_months, COUNT(*)
-- FROM user_subscription_history
-- GROUP BY subscription_type, duration_months;
