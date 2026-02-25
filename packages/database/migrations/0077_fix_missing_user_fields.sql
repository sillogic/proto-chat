-- Fix missing user fields
-- This migration ensures all required fields exist in the users table

-- Add interests field if it doesn't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "interests" varchar(64)[];

-- Add is_onboarded field if it doesn't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_onboarded" boolean DEFAULT false;

-- Add onboarding field if it doesn't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding" jsonb;

-- Add clerk_created_at field if it doesn't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_created_at" timestamp with time zone;

-- Add preference field if it doesn't exist (should already exist, but ensure it's there)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preference" jsonb;
