import { Worker } from 'bullmq';

import { createBullMQConnection } from '@/libs/bullmq';

import { dispatchAgentCronJobs } from './processors/dispatch';
import { executeAgentCronJob } from './processors/executeJob';
import {
  type ExecuteAgentCronJobData,
  getAgentCronDispatchQueue,
  getAgentCronExecutionQueue,
} from './queues';

export const startAgentCronJobWorkers = async () => {
  // ── Execution worker ─────────────────────────────────────
  // Processes individual agent cron job runs with capped concurrency
  // to prevent overwhelming the server / LLM provider.
  const executionWorker = new Worker<ExecuteAgentCronJobData>(
    'agent-cron-execution',
    executeAgentCronJob,
    { concurrency: 3, connection: createBullMQConnection() },
  );

  executionWorker.on('completed', (job, result) => {
    if (result?.skipped) {
      console.log(`[agent-cron:exec] Skipped job=${job.id}: ${result.reason}`);
    } else {
      console.log(`[agent-cron:exec] Done job=${job.id} topic=${result?.topicId}`);
    }
  });
  executionWorker.on('failed', (job, err) => {
    console.error(`[agent-cron:exec] Failed job=${job?.id}:`, err.message);
  });
  executionWorker.on('error', (err) => {
    console.error('[agent-cron:exec] Worker error:', err);
  });

  // ── Dispatch worker ──────────────────────────────────────
  // Fires every minute. Checks which agent cron jobs are due
  // and enqueues them into the execution queue.
  const dispatchWorker = new Worker(
    'agent-cron-dispatch',
    dispatchAgentCronJobs,
    { concurrency: 1, connection: createBullMQConnection() },
  );

  dispatchWorker.on('failed', (job, err) => {
    console.error(`[agent-cron:dispatch] Failed job=${job?.id}:`, err.message);
  });
  dispatchWorker.on('error', (err) => {
    console.error('[agent-cron:dispatch] Worker error:', err);
  });

  // ── Register repeatable dispatcher job ───────────────────
  // BullMQ stores this in Redis — idempotent across server restarts.
  // Only one instance of this job runs per minute even across multiple server replicas.
  const dispatchQueue = getAgentCronDispatchQueue();
  await dispatchQueue.add('dispatch', {}, {
    repeat: { pattern: '* * * * *' },
  });

  // Ensure execution queue is initialised
  getAgentCronExecutionQueue();

  console.log('[agent-cron] Workers started — dispatcher registered (* * * * *)');
};
