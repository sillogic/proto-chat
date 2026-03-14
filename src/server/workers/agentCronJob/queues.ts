import { Queue } from 'bullmq';

import { createBullMQConnection } from '@/libs/bullmq';

// ── Dispatch queue ────────────────────────────────────────────
// A single repeatable job (* * * * *) fires here every minute.
// Its processor checks which agent cron jobs are due and enqueues them.

let _dispatchQueue: Queue | null = null;

export const getAgentCronDispatchQueue = (): Queue => {
  if (!_dispatchQueue) {
    _dispatchQueue = new Queue('agent-cron-dispatch', {
      connection: createBullMQConnection(),
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    });
  }
  return _dispatchQueue;
};

// ── Execution queue ───────────────────────────────────────────
// One job per agent cron job instance.
// Worker runs with concurrency: 3 to cap simultaneous LLM calls.

export interface ExecuteAgentCronJobData {
  agentCronJobId: string;
  agentId: string;
  userId: string;
}

let _executionQueue: Queue<ExecuteAgentCronJobData> | null = null;

export const getAgentCronExecutionQueue = (): Queue<ExecuteAgentCronJobData> => {
  if (!_executionQueue) {
    _executionQueue = new Queue<ExecuteAgentCronJobData>('agent-cron-execution', {
      connection: createBullMQConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { delay: 15_000, type: 'exponential' },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
  }
  return _executionQueue;
};
