-- Migration: Add user price columns to model_pricings table
-- Description: Store pre-calculated user prices (cost price × multiplier) for performance optimization
-- Date: 2026-01-08

-- Step 1: Add user price columns
ALTER TABLE "model_pricings"
ADD COLUMN IF NOT EXISTS "user_input_price" numeric(15, 6) DEFAULT '0' NOT NULL,
ADD COLUMN IF NOT EXISTS "user_output_price" numeric(15, 6) DEFAULT '0' NOT NULL;

-- Step 2: Add sub_provider column if not exists (for ProtoChat)
ALTER TABLE "model_pricings"
ADD COLUMN IF NOT EXISTS "sub_provider" text;

-- Step 3: Drop old unique index if exists
DROP INDEX IF EXISTS "model_provider_idx";

-- Step 4: Create new unique index including sub_provider
CREATE UNIQUE INDEX IF NOT EXISTS "model_provider_subprovider_idx"
ON "model_pricings" ("model", "provider", "sub_provider");

-- Step 5: Initialize user prices from existing cost prices
-- Assuming default multiplier of 1.0 if protochat_settings doesn't exist yet
DO $$
DECLARE
    multiplier_value NUMERIC(10, 4);
BEGIN
    -- Get multiplier from settings
    SELECT COALESCE((SELECT value::numeric FROM protochat_settings WHERE id = 'pricing_multiplier'), 1.0)
    INTO multiplier_value;

    -- Update all existing records
    UPDATE model_pricings
    SET
        user_input_price = input_price::numeric * multiplier_value,
        user_output_price = output_price::numeric * multiplier_value,
        updated_at = NOW()
    WHERE user_input_price = 0 AND user_output_price = 0;

    RAISE NOTICE 'Updated user prices with multiplier: %', multiplier_value;
END $$;

-- Step 6: Insert default pricing_multiplier setting if not exists
INSERT INTO protochat_settings (id, value, description, updated_at)
VALUES ('pricing_multiplier', '1.0', '定价系数：用户价 = 成本价 x 系数', NOW())
ON CONFLICT (id) DO NOTHING;
