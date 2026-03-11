import { MemorySourceType } from '@lobechat/types';
import { type Job } from 'bullmq';
import { chunk } from 'es-toolkit/compat';

import { appEnv } from '@/envs/app';
import { parseMemoryExtractionConfig } from '@/server/globalConfig/parseMemoryExtractionConfig';
import {
  buildWorkflowPayloadInput,
  MemoryExtractionExecutor,
  normalizeMemoryExtractionPayload,
} from '@/server/services/memory/userMemory/extract';

import { type HourlyAnalysisJobData, getHourlyAnalysisQueue, getProcessUsersQueue } from '../queues';

const USER_PAGE_SIZE = 200;
const USER_BATCH_SIZE = 20;

const resolveBaseUrl = () => {
  const { webhook } = parseMemoryExtractionConfig();
  return webhook.baseUrl || appEnv.INTERNAL_APP_URL || appEnv.APP_URL;
};

export const processHourlyAnalysis = async (job: Job<HourlyAnalysisJobData>) => {
  const { cursor, dryRun } = job.data;

  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error('Missing baseUrl for hourly memory extraction');
  }

  const parsedCursor = cursor
    ? { createdAt: new Date(cursor.createdAt), id: cursor.id }
    : undefined;

  if (parsedCursor && Number.isNaN(parsedCursor.createdAt.getTime())) {
    throw new Error('Invalid cursor date for hourly memory extraction');
  }

  const executor = await MemoryExtractionExecutor.create();
  const userBatch = await executor.getUsersForHourlyExtraction(USER_PAGE_SIZE, parsedCursor);

  const userIds = userBatch.ids;
  if (userIds.length === 0) {
    console.log('[memory:hourly] No eligible users for hourly memory extraction.');
    return { message: 'No eligible users for hourly memory extraction.', processedUsers: 0 };
  }

  const nextCursor = userBatch.cursor
    ? {
        createdAt: userBatch.cursor.createdAt.toISOString(),
        id: userBatch.cursor.id,
      }
    : undefined;

  const processUsersQueue = getProcessUsersQueue();

  if (!dryRun) {
    const batches = chunk(userIds, USER_BATCH_SIZE);
    await Promise.all(
      batches.map((batchUserIds) =>
        processUsersQueue.add(
          'process-users',
          buildWorkflowPayloadInput(
            normalizeMemoryExtractionPayload({
              baseUrl,
              mode: 'workflow',
              sources: [MemorySourceType.ChatTopic],
              userIds: batchUserIds,
            }),
          ),
        ),
      ),
    );
  }

  // Enqueue next page if more users remain
  if (nextCursor) {
    const hourlyQueue = getHourlyAnalysisQueue();
    await hourlyQueue.add('hourly-analysis', { cursor: nextCursor, dryRun }, {
      jobId: `hourly-analysis:${nextCursor.id}`,
    });
  }

  console.log('[memory:hourly] Processed batch:', {
    dryRun: !!dryRun,
    hasNextPage: !!nextCursor,
    processedUsers: userIds.length,
    scheduledBatches: dryRun ? 0 : chunk(userIds, USER_BATCH_SIZE).length,
  });

  return {
    dryRun: !!dryRun,
    hasNextPage: !!nextCursor,
    processedUsers: userIds.length,
  };
};
