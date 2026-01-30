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
  const config: any = {};

  // WeChat Pay configuration (optional)
  if (process.env.WECHAT_PAY_APP_ID && process.env.WECHAT_PAY_MCH_ID && process.env.WECHAT_PAY_API_KEY) {
    config.wechat = {
      appId: process.env.WECHAT_PAY_APP_ID,
      mchId: process.env.WECHAT_PAY_MCH_ID,
      apiKey: process.env.WECHAT_PAY_API_KEY,
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
    };
  }

  // Alipay configuration (optional)
  if (process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY && process.env.ALIPAY_PUBLIC_KEY) {
    config.alipay = {
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      sandbox: process.env.ALIPAY_SANDBOX === 'true',
      gatewayUrl: process.env.ALIPAY_GATEWAY_URL,
    };
  }

  // Validate at least one payment method is configured
  if (!config.wechat && !config.alipay) {
    throw new Error('No payment method configured. Please configure WeChat Pay or Alipay in environment variables.');
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
        payChannel: z.enum(['wechat_native', 'alipay_precreate']).default('alipay_precreate'),
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
