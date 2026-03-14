import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const cronJobLogs = pgTable('cron_job_logs', {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  durationMs: integer('duration_ms'),
  error: text('error'),
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  jobName: text('job_name').notNull(),
  jobPath: text('job_path').notNull(),
  result: jsonb('result'),
  status: text('status', { enum: ['success', 'error'] }).notNull(),
});
