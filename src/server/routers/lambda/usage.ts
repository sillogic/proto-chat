import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { UsageRecordService } from '@/server/services/usage';
import { UserUsageService } from '@/server/services/user/usageService';

const usageProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      usageRecordService: new UsageRecordService(ctx.serverDB, ctx.userId),
      userUsageService: new UserUsageService(ctx.serverDB, ctx.userId),
    },
  });
});

export const usageRouter = router({
  findAndGroupByDay: usageProcedure
    .input(
      z.object({
        mo: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.usageRecordService.findAndGroupByDay(input.mo);
    }),

  findByMonth: usageProcedure
    .input(
      z.object({
        mo: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.usageRecordService.findByMonth(input.mo);
    }),

  getAccountStatistics: usageProcedure
    .input(z.object({ mo: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return await ctx.userUsageService.getAccountStatistics(input?.mo);
    }),

  getConsumptionDetails: usageProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().optional(),
        model: z.string().optional(),
        offset: z.number().optional(),
        type: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.userUsageService.getConsumptionDetails(input.limit, input.offset, {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        model: input.model,
        type: input.type,
      });
    }),

  getTransactions: usageProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().optional(),
        mo: z.string().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.userUsageService.getTransactions(input.limit, input.offset, input.mo, input.dateFrom, input.dateTo);
    }),

  getUsageDetails: usageProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        mo: z.string().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.userUsageService.getUsageDetails(input.limit, input.offset, input.mo);
    }),
});
