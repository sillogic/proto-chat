# Database Migration Guide - One-Time Payment Feature

## Overview

This directory contains SQL migration scripts to add one-time payment support to the database.

## Files

1. **add-onetime-payment-fields.sql** - Adds `subscription_type` and `duration_months` fields
2. **reset-users-to-free.sql** - Resets all paid users to Free plan for testing

## Migration Steps

### Step 1: Add New Fields

This adds support for three payment modes:
- `recurring` + `billingInterval='month'` - 月订阅
- `recurring` + `billingInterval='year'` - 年订阅
- `onetime` + `duration_months=1/3/6/12` - 一次性付费

```bash
# Connect to your database and run:
psql -U your_username -d your_database -f add-onetime-payment-fields.sql

# Or if using npm/bun scripts:
bun db:execute add-onetime-payment-fields.sql
```

### Step 2: Reset Users to Free (Optional, for testing)

⚠️ **WARNING**: This will remove all active subscriptions! Only use in development/testing!

```bash
# Connect to your database and run:
psql -U your_username -d your_database -f reset-users-to-free.sql
```

## Alternative: Manual Execution

You can also copy and paste the SQL commands directly into your database client:

### Using Database Studio
1. Run `bun run db:studio`
2. Open the SQL editor
3. Paste and execute the migration SQL

### Using psql
```bash
# Connect to database
psql -U your_username -d your_database

# Run the migration
\i scripts/migrations/add-onetime-payment-fields.sql
\i scripts/migrations/reset-users-to-free.sql
```

## Verification

After running migrations, verify with these queries:

```sql
-- Check field existence
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_extensions'
  AND column_name IN ('subscription_type', 'duration_months');

-- Check data distribution
SELECT subscription_type, duration_months, COUNT(*)
FROM user_extensions
GROUP BY subscription_type, duration_months;

-- Verify Free plan users
SELECT current_plan, COUNT(*)
FROM user_extensions
GROUP BY current_plan;
```

## Rollback

If you created a backup table before resetting users:

```sql
-- Restore from backup
UPDATE user_extensions ue
SET
    current_plan = b.current_plan,
    plan_id = b.plan_id,
    plan_expires_at = b.plan_expires_at,
    billing_interval = b.billing_interval,
    subscription_type = b.subscription_type,
    duration_months = b.duration_months
FROM user_extensions_backup_20260130 b
WHERE ue.user_id = b.user_id;
```

## Next Steps

After running migrations:
1. Update Drizzle schema files to include new fields
2. Run `bun run db:generate` to regenerate types
3. Implement frontend three-tab layout
4. Update payment service to handle subscription_type and duration_months
5. Test payment flow with all three modes

## Notes

- All existing subscriptions will be marked as `recurring` type
- `duration_months` defaults to NULL for recurring subscriptions
- CHECK constraints ensure `duration_months` only accepts 1, 3, 6, or 12
- Indexes are created for better query performance
