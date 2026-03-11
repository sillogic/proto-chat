import { type MemoryExtractionPayloadInput } from '@/server/services/memory/userMemory/extract';

import {
  type HourlyAnalysisJobData,
  getHourlyAnalysisQueue,
  getProcessUsersQueue,
} from './queues';

/**
 * BullMQ-backed replacement for MemoryExtractionWorkflowService.
 *
 * Call these methods from API routes / cron endpoints to enqueue jobs.
 * The actual extraction logic runs in the workers (src/server/workers/memoryExtraction/index.ts).
 */
export class MemoryExtractionBullMQService {
  /**
   * Enqueue the hourly analysis job (triggered by cron).
   * The worker handles user pagination internally and fans out process-users jobs.
   */
  static async enqueueHourlyAnalysis(data: HourlyAnalysisJobData = {}) {
    const queue = getHourlyAnalysisQueue();
    return queue.add('hourly-analysis', data, {
      // Deduplicate: only one hourly root job at a time (ignore if already queued)
      jobId: data.cursor ? `hourly-analysis:${data.cursor.id}` : 'hourly-analysis:root',
    });
  }

  /**
   * Enqueue a process-users job.
   * The worker paginates users and fans out process-user-topics jobs.
   */
  static async enqueueProcessUsers(payload: MemoryExtractionPayloadInput) {
    const queue = getProcessUsersQueue();
    return queue.add('process-users', payload);
  }
}
