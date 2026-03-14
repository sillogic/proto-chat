-- Cron Job Execution Logs
-- Records the result of each scheduled task execution for admin visibility
CREATE TABLE IF NOT EXISTS "cron_job_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_name" text NOT NULL,
  "job_path" text NOT NULL,
  "status" text NOT NULL,
  "result" jsonb,
  "error" text,
  "duration_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "cron_job_logs_job_name_idx" ON "cron_job_logs" ("job_name");
CREATE INDEX IF NOT EXISTS "cron_job_logs_created_at_idx" ON "cron_job_logs" ("created_at");
