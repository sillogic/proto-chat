import { Queue } from 'bullmq';

import { createBullMQConnection } from '@/libs/bullmq';

export interface ExecuteAgentCronJobData {
  agentCronJobId: string;
  agentId: string;
  userId: string;
}

let _queue: Queue<ExecuteAgentCronJobData> | null = null;

export const getAgentCronExecutionQueue = (): Queue<ExecuteAgentCronJobData> => {
  if (!_queue) {
    _queue = new Queue<ExecuteAgentCronJobData>('agent-cron-execution', {
      connection: createBullMQConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { delay: 15_000, type: 'exponential' },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
  }
  return _queue;
};
