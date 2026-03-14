import { Worker } from 'bullmq';

import { createBullMQConnection } from '@/libs/bullmq';

import { executeAgentCronJob } from './processors/executeJob';
import { type ExecuteAgentCronJobData, getAgentCronExecutionQueue } from './queues';

export const startAgentCronJobWorkers = () => {
  // Ensure queue is initialized
  getAgentCronExecutionQueue();

  const worker = new Worker<ExecuteAgentCronJobData>(
    'agent-cron-execution',
    executeAgentCronJob,
    {
      // Limit concurrent LLM calls to avoid overloading the server / provider rate limits
      concurrency: 3,
      connection: createBullMQConnection(),
    },
  );

  worker.on('completed', (job, result) => {
    if (result?.skipped) {
      console.log(`[agent-cron:worker] Skipped job=${job.id}: ${result.reason}`);
    } else {
      console.log(`[agent-cron:worker] Completed job=${job.id} topic=${result?.topicId}`);
    }
  });

  worker.on('failed', (job, err) => {
    console.error(`[agent-cron:worker] Failed job=${job?.id}:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[agent-cron:worker] Worker error:', err);
  });

  return worker;
};
