import { TRPCError } from '@trpc/server';

import { serverDB } from '@/database/server';
import { type NewGeneration, type NewGenerationBatch } from '@/database/schemas';
import { type CreateImageServicePayload } from '@/server/routers/lambda/image';
import { CreditService } from '@/server/services/credit';

interface ChargeParams {
  clientIp?: string | null;
  configForDatabase: CreateImageServicePayload['params'];
  generationParams: CreateImageServicePayload['params'];
  generationTopicId: string;
  imageNum: number;
  model: string;
  provider: string;
  userId: string;
}

type ChargeResult =
  | undefined
  | {
      data: {
        batch: NewGenerationBatch;
        generations: NewGeneration[];
      };
      success: true;
    };

export async function chargeBeforeGenerate(params: ChargeParams): Promise<ChargeResult> {
  const { userId } = params;

  const creditService = new CreditService(serverDB, userId);
  const hasEnough = await creditService.hasEnoughCredits(0);

  if (!hasEnough) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'INSUFFICIENT_CREDITS' });
  }

  return undefined;
}
