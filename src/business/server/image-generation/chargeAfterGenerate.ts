import debug from 'debug';

import { serverDB } from '@/database/server';
import { type ModelUsage } from '@/types/index';

import { CreditService } from '../../../server/services/credit';

const log = debug('lobe-image:charge');

interface ChargeParams {
  metadata: {
    asyncTaskId: string;
    generationBatchId: string;
    modelId: string;
    topicId?: string;
  };
  modelUsage?: ModelUsage;
  provider: string;
  userId: string;
}

export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {
  const { userId, provider, metadata } = params;
  const { modelId, asyncTaskId } = metadata;

  try {
    const creditService = new CreditService(serverDB, userId);

    // Calculate cost for image generation (uses perRequestPrice from model_pricings)
    const cost = await creditService.calculateCost(modelId, provider, 0, 0);

    if (cost > 0) {
      await creditService.deductCredits(
        cost,
        `Image generation: ${modelId}`,
        metadata.generationBatchId,
        {
          model: modelId,
          provider,
          type: 'image',
          asyncTaskId,
          topicId: metadata.topicId,
        },
      );
      log('Credits deducted for image generation: taskId=%s, cost=%s', asyncTaskId, cost);
    } else {
      log('No cost calculated for image generation: taskId=%s, model=%s', asyncTaskId, modelId);
    }
  } catch (error: any) {
    console.error('[Image Generation] Failed to deduct credits:', error.message);
    // Don't throw - we don't want to fail the image generation if credit deduction fails
  }
}
