import debug from 'debug';

import { serverDB } from '@/database/server';
import { type ModelPerformance, type ModelUsage } from '@/types/index';

import { CreditService } from '../../../server/services/credit';

const log = debug('lobe-image:charge');

interface ChargeParams {
  /** Generation duration in milliseconds */
  duration?: number;
  /** Generated image height in pixels */
  height?: number;
  metadata: {
    asyncTaskId: string;
    generationBatchId: string;
    modelId: string;
    topicId?: string;
  };
  metrics?: ModelPerformance;
  modelUsage?: ModelUsage;
  provider: string;
  userId: string;
  /** Generated image width in pixels */
  width?: number;
}

export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {
  const { userId, provider, metadata, duration, width, height, modelUsage } = params;
  const { modelId, asyncTaskId } = metadata;

  try {
    const creditService = new CreditService(serverDB, userId);

    // Use actual token counts when available (Gemini/OpenRouter image models return usage data).
    // outputImageTokens are billed at userImageOutputPrice (higher rate than text output).
    // Falls back to perRequestPrice when all tokens are 0 (Replicate, ComfyUI, etc.).
    const inputTokens = modelUsage?.totalInputTokens ?? 0;
    const outputTextTokens = modelUsage?.outputTextTokens ?? 0;
    const outputImageTokens = modelUsage?.outputImageTokens ?? 0;

    const cost = await creditService.calculateCost(modelId, provider, inputTokens, outputTextTokens, outputImageTokens);

    if (cost > 0) {
      await creditService.deductCredits(
        cost,
        `Image generation: ${modelId}`,
        metadata.generationBatchId,
        {
          asyncTaskId,
          duration,
          height,
          model: modelId,
          provider,
          topicId: metadata.topicId,
          totalInputTokens: inputTokens || undefined,
          totalOutputTokens: (outputTextTokens + outputImageTokens) || undefined,
          outputImageTokens: outputImageTokens || undefined,
          type: 'image',
          width,
        },
      );
      log(
        'Credits deducted for image generation: taskId=%s, cost=%s, tokens=in:%d outText:%d outImg:%d',
        asyncTaskId,
        cost,
        inputTokens,
        outputTextTokens,
        outputImageTokens,
      );
    } else {
      log('No cost calculated for image generation: taskId=%s, model=%s', asyncTaskId, modelId);
    }
  } catch (error: any) {
    console.error('[Image Generation] Failed to deduct credits:', error.message);
    // Don't throw - we don't want to fail the image generation if credit deduction fails
  }
}
