import { type ExecuteAgentCronJobData, getAgentCronExecutionQueue } from './queues';

export class AgentCronJobBullMQService {
  /**
   * Enqueue a single agent cron job for execution.
   *
   * Uses a deterministic jobId (cronJobId + minute timestamp) so that if the
   * cron endpoint fires twice within the same minute, BullMQ silently deduplicates.
   */
  static async enqueueJob(data: ExecuteAgentCronJobData): Promise<string | undefined> {
    const minuteKey = Math.floor(Date.now() / 60_000);
    const jobId = `acron:${data.agentCronJobId}:${minuteKey}`;

    const queue = getAgentCronExecutionQueue();
    const job = await queue.add('execute', data, { jobId });
    return job.id;
  }
}
