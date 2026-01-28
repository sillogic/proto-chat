/**
 * Payment tRPC router
 * Handles payment operations for subscription upgrades
 */

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { PaymentService } from '@/server/modules/payment';
import { z } from 'zod';

const paymentProcedure = authedProcedure.use(serverDatabase);

// Initialize payment service with config from environment
function getPaymentService(serverDB: any) {
  const config = {
    wechat: {
      appId: process.env.WECHAT_PAY_APP_ID || '',
      mchId: process.env.WECHAT_PAY_MCH_ID || '',
      apiKey: process.env.WECHAT_PAY_API_KEY || '',
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
    },
  };

  // Validate WeChat config
  if (!config.wechat.appId || !config.wechat.mchId || !config.wechat.apiKey) {
    throw new Error('WeChat Pay configuration is incomplete. Please check environment variables.');
  }

  return new PaymentService(serverDB, config);
}

export const paymentRouter = router({
  /**
   * Create a new payment order
   * Returns order number and payment QR code URL
   */
  createOrder: paymentProcedure
    .input(
      z.object({
        planId: z.string().min(1, 'Plan ID is required'),
        interval: z.enum(['month', 'year'], {
          errorMap: () => ({ message: 'Interval must be month or year' }),
        }),
        payChannel: z.enum(['wechat_native']).default('wechat_native'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentService = getPaymentService(ctx.serverDB);

      const result = await paymentService.createOrder({
        userId: ctx.userId,
        planId: input.planId,
        planInterval: input.interval,
        payChannel: input.payChannel,
      });

      return {
        orderNo: result.orderNo,
        codeUrl: result.codeUrl,
        expiredAt: result.expiredAt.toISOString(),
        amount: result.amount,
      };
    }),

  /**
   * Query order status
   * Used by frontend to poll for payment completion
   */
  queryOrder: paymentProcedure
    .input(
      z.object({
        orderNo: z.string().min(1, 'Order number is required'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const paymentService = getPaymentService(ctx.serverDB);

      const result = await paymentService.queryOrder(input.orderNo);

      return {
        orderNo: result.orderNo,
        status: result.status,
        paidAt: result.paidAt?.toISOString(),
        amount: result.amount,
      };
    }),

  /**
   * Close an unpaid order
   * Called when user cancels payment or closes payment modal
   */
  closeOrder: paymentProcedure
    .input(
      z.object({
        orderNo: z.string().min(1, 'Order number is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentService = getPaymentService(ctx.serverDB);

      await paymentService.closeOrder(input.orderNo, ctx.userId);

      return { success: true };
    }),
});
