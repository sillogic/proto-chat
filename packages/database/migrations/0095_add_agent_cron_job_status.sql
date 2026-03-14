-- Add execution status tracking columns to agent_cron_jobs
-- Allows users to see at a glance whether their last execution succeeded or failed

ALTER TABLE "agent_cron_jobs"
  ADD COLUMN IF NOT EXISTS "last_execution_status" text,
  ADD COLUMN IF NOT EXISTS "last_execution_error" text;

COMMENT ON COLUMN "agent_cron_jobs"."last_execution_status" IS 'success | failed — result of the most recent execution';
COMMENT ON COLUMN "agent_cron_jobs"."last_execution_error" IS 'Error message from the most recent failed execution';
