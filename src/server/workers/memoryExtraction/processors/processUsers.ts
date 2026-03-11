import { type Job } from 'bullmq';
import { chunk } from 'es-toolkit/compat';

import {
  buildWorkflowPayloadInput,
  MemoryExtractionExecutor,
  memoryExtractionPayloadSchema,
  normalizeMemoryExtractionPayload,
} from '@/server/services/memory/userMemory/extract';

import { getProcessUserTopicsQueue, getProcessUsersQueue, type ProcessUsersJobData } from '../queues';

const USER_PAGE_SIZE = 50;
const USER_BATCH_SIZE = 10;

export const processUsers = async (job: Job<ProcessUsersJobData>) => {
  // Re-parse via zod to coerce Date strings back to Date objects after JSON round-trip
  const parsed = memoryExtractionPayloadSchema.parse(job.data);
  const params = normalizeMemoryExtractionPayload(parsed);

  if (params.sources.length === 0) {
    return { message: 'No sources provided, skip memory extraction.' };
  }

  const executor = await MemoryExtractionExecutor.create();

  const userCursor = params.userCursor
    ? { createdAt: new Date(params.userCursor.createdAt), id: params.userCursor.id }
    : undefined;

  const userBatch =
    params.userIds.length > 0
      ? { ids: params.userIds }
      : await executor.getUsers(USER_PAGE_SIZE, userCursor);

  const ids = userBatch.ids;
  if (ids.length === 0) {
    return { message: 'No users to process for memory extraction.' };
  }

  const cursor = 'cursor' in userBatch ? userBatch.cursor : undefined;

  const processUserTopicsQueue = getProcessUserTopicsQueue();
  const batches = chunk(ids, USER_BATCH_SIZE);

  await Promise.all(
    batches.map((userIds) =>
      processUserTopicsQueue.add(
        'process-user-topics',
        buildWorkflowPayloadInput({
          ...params,
          topicCursor: undefined,
          userId: userIds[0],
          userIds,
        }),
      ),
    ),
  );

  // Schedule next page of users if paginating
  if (params.userIds.length === 0 && cursor) {
    await getProcessUsersQueue().add(
      'process-users',
      buildWorkflowPayloadInput({
        ...params,
        userCursor: { createdAt: cursor.createdAt.toISOString(), id: cursor.id },
      }),
    );
  }

  console.log('[memory:process-users] Done:', {
    batches: batches.length,
    nextCursor: cursor ? cursor.id : null,
    processedUsers: ids.length,
  });

  return {
    batches: batches.length,
    nextCursor: cursor ? cursor.id : null,
    processedUsers: ids.length,
  };
};
