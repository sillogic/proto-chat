import { TRPCError } from '@trpc/server';

import { trpc } from '@/libs/trpc/lambda/init';
import { CreditService } from '@/server/services/credit';

export const checkFileStorageUsage = trpc.middleware(async (opts) => {
  return opts.next();
});

export const checkBudgetsUsage = trpc.middleware(async (opts) => {
  const ctx = opts.ctx as any;
  if (ctx.serverDB && ctx.userId) {
    const creditService = new CreditService(ctx.serverDB, ctx.userId);
    const hasEnough = await creditService.hasEnoughCredits(0);
    if (!hasEnough) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'INSUFFICIENT_CREDITS' });
    }
  }
  return opts.next();
});
