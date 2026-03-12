-- Migration: Add cache pricing columns
-- Adds cache read pricing support for models that support prompt caching (e.g. Claude, Gemini, some OpenRouter models)

-- Add cost_cache_read_price to protochat_model_pricing table
-- NULL means no cache support; a value means cached tokens can be billed at this rate
ALTER TABLE protochat_model_pricing
    ADD COLUMN IF NOT EXISTS cost_cache_read_price NUMERIC(15, 6);

-- Add cache read pricing columns to model_pricings table
-- cacheReadPrice: cost price in credits per 1M cached input tokens
-- userCacheReadPrice: user price = cost price × multiplier
ALTER TABLE model_pricings
    ADD COLUMN IF NOT EXISTS cache_read_price NUMERIC(15, 6) NOT NULL DEFAULT 0;

ALTER TABLE model_pricings
    ADD COLUMN IF NOT EXISTS user_cache_read_price NUMERIC(15, 6) NOT NULL DEFAULT 0;
