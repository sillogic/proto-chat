-- Migration: Add user_agreements table and new columns to user_extensions
-- For recurring subscription (周期扣款) support

-- ============ 1. Create user_agreements table ============
CREATE TABLE IF NOT EXISTS "user_agreements" (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" text NOT NULL,

    -- 签约信息
    "agreement_no" varchar(64),
    "external_agreement_no" varchar(64) UNIQUE NOT NULL,
    "sign_scene" varchar(64) NOT NULL,
    "sign_channel" varchar(20) NOT NULL,

    -- 关联订阅
    "plan_id" text NOT NULL,
    "plan_slug" varchar(32) NOT NULL,
    "plan_name" varchar(64) NOT NULL,
    "billing_interval" varchar(10) NOT NULL,

    -- 扣款规则
    "single_amount" integer NOT NULL,
    "period_type" varchar(10) NOT NULL,
    "period" integer NOT NULL,
    "next_deduct_date" date,

    -- 签约状态
    "status" varchar(20) DEFAULT 'pending' NOT NULL,
    "sign_time" timestamp,
    "unsign_time" timestamp,
    "unsign_reason" varchar(32),

    -- 扣款状态
    "last_deduct_status" varchar(20),
    "last_deduct_time" timestamp,
    "last_deduct_order_no" varchar(64),
    "deduct_fail_count" integer DEFAULT 0,
    "deduct_fail_reason" text,

    -- 支付宝用户信息
    "alipay_user_id" varchar(64),
    "alipay_open_id" varchar(128),
    "alipay_logon_id" varchar(64),

    -- 扩展信息
    "first_order_no" varchar(64),
    "metadata" jsonb,

    -- 时间戳
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for user_agreements
CREATE INDEX IF NOT EXISTS "user_agreements_user_id_idx" ON "user_agreements" ("user_id");
CREATE INDEX IF NOT EXISTS "user_agreements_status_idx" ON "user_agreements" ("status");
CREATE INDEX IF NOT EXISTS "user_agreements_next_deduct_date_idx" ON "user_agreements" ("next_deduct_date");

-- ============ 2. Add new columns to user_extensions ============
-- Note: Using DO block to safely add columns only if they don't exist

DO $$
BEGIN
    -- Add current_agreement_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_extensions' AND column_name = 'current_agreement_id'
    ) THEN
        ALTER TABLE "user_extensions" ADD COLUMN "current_agreement_id" text;
    END IF;

    -- Add auto_renew column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_extensions' AND column_name = 'auto_renew'
    ) THEN
        ALTER TABLE "user_extensions" ADD COLUMN "auto_renew" boolean DEFAULT false;
    END IF;

    -- Add downgrade_reason column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_extensions' AND column_name = 'downgrade_reason'
    ) THEN
        ALTER TABLE "user_extensions" ADD COLUMN "downgrade_reason" text;
    END IF;

    -- Add previous_plan_slug column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_extensions' AND column_name = 'previous_plan_slug'
    ) THEN
        ALTER TABLE "user_extensions" ADD COLUMN "previous_plan_slug" text;
    END IF;

    -- Add previous_plan_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_extensions' AND column_name = 'previous_plan_name'
    ) THEN
        ALTER TABLE "user_extensions" ADD COLUMN "previous_plan_name" text;
    END IF;

    -- Add downgrade_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_extensions' AND column_name = 'downgrade_at'
    ) THEN
        ALTER TABLE "user_extensions" ADD COLUMN "downgrade_at" timestamp;
    END IF;
END $$;
