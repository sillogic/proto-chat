-- Fix embedding_usage_logs column types
-- 1. Change file_id from uuid to text to match files.id type
-- 2. Increase cost_price and user_price precision from decimal(15,4) to decimal(15,8)
--    to support very small cost values like $0.00000001

-- Fix file_id type
ALTER TABLE "embedding_usage_logs" DROP COLUMN IF EXISTS "file_id";
ALTER TABLE "embedding_usage_logs" ADD COLUMN "file_id" text;

-- Fix cost_price precision (increase scale from 4 to 8)
ALTER TABLE "embedding_usage_logs" ALTER COLUMN "cost_price" TYPE numeric(15, 8);

-- Fix user_price precision (increase scale from 4 to 8)
ALTER TABLE "embedding_usage_logs" ALTER COLUMN "user_price" TYPE numeric(15, 8);
