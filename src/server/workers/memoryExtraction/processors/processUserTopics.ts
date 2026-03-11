import { MemorySourceType } from '@lobechat/types';
import { type Job } from 'bullmq';

import { type ListTopicsForMemoryExtractorCursor } from '@/database/models/topic';
import {
  buildWorkflowPayloadInput,
  MemoryExtractionExecutor,
  memoryExtractionPayloadSchema,
  normalizeMemoryExtractionPayload,
} from '@/server/services/memory/userMemory/extract';
import { forEachBatchSequential } from '@/server/services/memory/userMemory/topicBatching';

import { getProcessTopicsQueue, getProcessUserTopicsQueue, type ProcessUserTopicsJobData } from '../queues';

const TOPIC_PAGE_SIZE = 50;
const TOPIC_BATCH_SIZE = 4;

export const processUserTopics = async (job: Job<ProcessUserTopicsJobData>) => {
  const parsed = memoryExtractionPayloadSchema.parse(job.data);
  const params = normalizeMemoryExtractionPayload(parsed);

  if (!params.userIds.length) {
    return { message: 'No user ids provided for topic processing.' };
  }
  if (!params.sources.includes(MemorySourceType.ChatTopic)) {
    return { message: 'No supported sources requested, skip topic processing.' };
  }

  const executor = await MemoryExtractionExecutor.create();
  const processTopicsQueue = getProcessTopicsQueue();
  const processUserTopicsQueue = getProcessUserTopicsQueue();

  for (const userId of params.userIds) {
    const topicCursor =
      params.topicCursor && params.topicCursor.userId === userId
        ? {
            createdAt: new Date(params.topicCursor.createdAt),
            id: params.topicCursor.id,
          }
        : undefined;

    const topicsFromPayload =
      params.topicIds && params.topicIds.length > 0
        ? await executor.filterTopicIdsForUser(userId, params.topicIds).then((f) =>
            f.length > 0 ? f : undefined,
          )
        : undefined;

    const topicBatch = await (topicsFromPayload && topicsFromPayload.length > 0
      ? Promise.resolve({ ids: topicsFromPayload })
      : executor.getTopicsForUser(
          {
            cursor: topicCursor,
            forceAll: params.forceAll,
            forceTopics: params.forceTopics,
            from: params.from,
            to: params.to,
            userId,
          },
          TOPIC_PAGE_SIZE,
        ));

    const ids = topicBatch.ids;
    if (!ids.length) continue;

    const cursor = 'cursor' in topicBatch
      ? (topicBatch.cursor as ListTopicsForMemoryExtractorCursor | undefined)
      : undefined;

    await forEachBatchSequential(ids, TOPIC_BATCH_SIZE, async (topicIds) => {
      await processTopicsQueue.add('process-topics', {
        ...buildWorkflowPayloadInput(params),
        topicCursor: undefined,
        topicIds,
        userId,
        userIds: [userId],
      });
    });

    // Schedule next page of topics for this user
    if (!topicsFromPayload && cursor) {
      const createdAt = new Date(cursor.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        throw new Error('Invalid cursor date when scheduling next topic page');
      }

      await processUserTopicsQueue.add('process-user-topics', {
        ...buildWorkflowPayloadInput({
          ...params,
          topicCursor: {
            createdAt: createdAt.toISOString(),
            id: cursor.id,
            userId,
          },
          topicIds: [],
          userId,
          userIds: [userId],
        }),
      });
    }
  }

  console.log('[memory:process-user-topics] Done:', { processedUsers: params.userIds.length });

  return { processedUsers: params.userIds.length };
};
