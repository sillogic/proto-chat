import { LayersEnum, MemorySourceType } from '@lobechat/types';
import { type Job } from 'bullmq';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { getServerDB } from '@/database/server';
import {
  MemoryExtractionExecutor,
  memoryExtractionPayloadSchema,
  normalizeMemoryExtractionPayload,
} from '@/server/services/memory/userMemory/extract';

import { getUpdatePersonaQueue, type ProcessTopicsJobData } from '../queues';

const CEPA_LAYERS: LayersEnum[] = [
  LayersEnum.Context,
  LayersEnum.Experience,
  LayersEnum.Preference,
  LayersEnum.Activity,
];

const IDENTITY_LAYERS: LayersEnum[] = [LayersEnum.Identity];

export const processTopics = async (job: Job<ProcessTopicsJobData>) => {
  const parsed = memoryExtractionPayloadSchema.parse(job.data);
  const payload = normalizeMemoryExtractionPayload(parsed);

  if (!payload.userIds.length) {
    return { message: 'No user id provided for topic batch.', processedTopics: 0, processedUsers: 0 };
  }
  if (!payload.topicIds.length) {
    return { message: 'No topic ids provided for extraction.', processedTopics: 0, processedUsers: 0 };
  }
  if (!payload.sources.includes(MemorySourceType.ChatTopic)) {
    return { message: 'Source not supported in topic batch.', processedTopics: 0, processedUsers: 0 };
  }

  const userId = payload.userIds[0];
  const executor = await MemoryExtractionExecutor.create();

  const cepaLayers = payload.layers.length
    ? payload.layers.filter((l) => CEPA_LAYERS.includes(l))
    : CEPA_LAYERS;

  const identityLayers = payload.layers.length
    ? payload.layers.filter((l) => IDENTITY_LAYERS.includes(l))
    : IDENTITY_LAYERS;

  const errors: Array<{ error: string; topicId: string }> = [];

  // Process each topic: CEPA first, then Identity (sequential within topic)
  await Promise.all(
    payload.topicIds.map(async (topicId) => {
      try {
        if (cepaLayers.length > 0) {
          await executor.extractTopic({
            asyncTaskId: payload.asyncTaskId,
            forceAll: payload.forceAll,
            forceTopics: payload.forceTopics,
            from: payload.from,
            layers: cepaLayers,
            source: MemorySourceType.ChatTopic,
            to: payload.to,
            topicId,
            userId,
            userInitiated: payload.userInitiated,
          });
        }

        if (identityLayers.length > 0) {
          await executor.extractTopic({
            asyncTaskId: payload.asyncTaskId,
            forceAll: payload.forceAll,
            forceTopics: payload.forceTopics,
            from: payload.from,
            layers: identityLayers,
            source: MemorySourceType.ChatTopic,
            to: payload.to,
            topicId,
            userId,
            userInitiated: payload.userInitiated,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[memory:process-topics] Failed to process topic ${topicId}:`, error);
        errors.push({ error: message, topicId });

        // Update async task progress on failure (mirrors Upstash failureFunction)
        if (payload.asyncTaskId) {
          try {
            const db = await getServerDB();
            const asyncTaskModel = new AsyncTaskModel(db, userId);
            await asyncTaskModel.incrementUserMemoryExtractionProgress(payload.asyncTaskId);
          } catch (taskError) {
            console.error('[memory:process-topics] Failed to update async task:', taskError);
          }
        }
      }
    }),
  );

  // Trigger persona update after processing this topic batch
  await getUpdatePersonaQueue().add('update-persona', { userId });

  return {
    errors,
    processedTopics: payload.topicIds.length,
    processedUsers: 1,
  };
};
