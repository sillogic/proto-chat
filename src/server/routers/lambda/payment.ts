/**
 * Payment tRPC router
 * Handles payment operations for subscription upgrades
 */

import { paymentOrders, subscriptionPlans } from '@lobechat/database';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { PaymentService } from '@/server/modules/payment';

const paymentProcedure = authedProcedure.use(serverDatabase);

// Initialize payment service with config from environment
function getPaymentService(serverDB: any) {
  const config: any = {};

  // WeChat Pay configuration (optional)
  if (process.env.WECHAT_PAY_APP_ID && process.env.WECHAT_PAY_MCH_ID && process.env.WECHAT_PAY_API_KEY) {
    config.wechat = {
      apiKey: process.env.WECHAT_PAY_API_KEY,
      appId: process.env.WECHAT_PAY_APP_ID,
      mchId: process.env.WECHAT_PAY_MCH_ID,
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
    };
  }

  // Alipay configuration (optional)
  if (process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY && process.env.ALIPAY_PUBLIC_KEY) {
    config.alipay = {
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      appId: process.env.ALIPAY_APP_ID,
      gatewayUrl: process.env.ALIPAY_GATEWAY_URL,
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      sandbox: process.env.ALIPAY_SANDBOX === 'true',
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
   * Cancel auto-renewal (unsign agreement)
   * User can cancel auto-renewal, subscription continues until expiry
   */
cancelAutoRenewal: paymentProcedure
    .input(
      z.object({
        agreementId: z.string().min(1, 'Agreement ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentService = getPaymentService(ctx.serverDB);

      const result = await paymentService.unsignAgreement(input.agreementId, ctx.userId);

      return { success: result.success };
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

  
  



/**
   * Create a new payment order
   * Returns order number and payment QR code URL
   */
createOrder: paymentProcedure
    .input(
      z.object({
        discountAmount: z.number().min(0).optional(),
        durationMonths: z.number().optional(),
        interval: z.enum(['month', 'year'], {
          errorMap: () => ({ message: 'Interval must be month or year' }),
        }),
        payChannel: z.enum(['wechat_native', 'alipay_precreate']).default('alipay_precreate'),
        planId: z.string().min(1, 'Plan ID is required'),
        residualValue: z.number().min(0).optional(),
        subscriptionType: z.enum(['recurring', 'onetime'], {
          errorMap: () => ({ message: 'Subscription type must be recurring or onetime' }),
        }),
      }).refine(
        (data) => {
          // If subscriptionType is 'onetime', durationMonths is required
          if (data.subscriptionType === 'onetime' && !data.durationMonths) {
            return false;
          }
          // If subscriptionType is 'recurring', durationMonths should not be provided
          if (data.subscriptionType === 'recurring' && data.durationMonths !== undefined) {
            return false;
          }
          // For onetime, durationMonths must be 1, 3, 6, or 12
          if (data.subscriptionType === 'onetime' && data.durationMonths !== undefined) {
            return [1, 3, 6, 12].includes(data.durationMonths);
          }
          return true;
        },
        {
          message: 'Invalid durationMonths: required for onetime (must be 1, 3, 6, or 12), must not be provided for recurring',
        }
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentService = getPaymentService(ctx.serverDB);

      const result = await paymentService.createOrder({
        discountAmount: input.discountAmount,
        durationMonths: input.durationMonths,
        payChannel: input.payChannel,
        planId: input.planId,
        planInterval: input.interval,
        residualValue: input.residualValue,
        subscriptionType: input.subscriptionType,
        userId: ctx.userId,
      });

      return {
        amount: result.amount,
        codeUrl: result.codeUrl,
        expiredAt: result.expiredAt.toISOString(),
        orderNo: result.orderNo,
      };
    }),

  
  



/**
   * Create a sign + pay order for recurring subscriptions
   * This initiates the signing process with first payment
   */
createSignPaymentOrder: paymentProcedure
    .input(
      z.object({
        billingInterval: z.enum(['month', 'year'], {
          errorMap: () => ({ message: 'Billing interval must be month or year' }),
        }),
        planId: z.string().min(1, 'Plan ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentService = getPaymentService(ctx.serverDB);

      const result = await paymentService.createSignPaymentOrder({
        billingInterval: input.billingInterval,
        planId: input.planId,
        userId: ctx.userId,
      });

      return {
        agreementId: result.agreementId,
        amount: result.amount,
        codeUrl: result.codeUrl,
        expiredAt: result.expiredAt.toISOString(),
        externalAgreementNo: result.externalAgreementNo,
        orderNo: result.orderNo,
      };
    }),

  
  

/**
   * Get user's order history
   * Returns list of all payment orders for the current user
   */
getOrderHistory: paymentProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Query orders with plan information
      const orders = await ctx.serverDB
        .select({
          
          amount: paymentOrders.amount,
          
createdAt: paymentOrders.createdAt,
          
currency: paymentOrders.currency,
          
durationMonths: paymentOrders.durationMonths,
          
expiredAt: paymentOrders.expiredAt,
          // Order fields
id: paymentOrders.id,
          orderNo: paymentOrders.orderNo,
          paidAt: paymentOrders.paidAt,
          payChannel: paymentOrders.payChannel,
          // Plan fields
planId: subscriptionPlans.id,
          
planInterval: paymentOrders.planInterval,
          
planName: subscriptionPlans.name,
          
          planSlug: subscriptionPlans.slug,
          status: paymentOrders.status,
          subscriptionType: paymentOrders.subscriptionType,
        })
        .from(paymentOrders)
        .leftJoin(subscriptionPlans, eq(paymentOrders.planId, subscriptionPlans.id))
        .where(
          and(
            eq(paymentOrders.userId, ctx.userId),
            notInArray(paymentOrders.status, ['closed', 'pending']),
          ),
        )
        .orderBy(desc(paymentOrders.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const countResult = await ctx.serverDB
        .select({ count: paymentOrders.id })
        .from(paymentOrders)
        .where(
          and(
            eq(paymentOrders.userId, ctx.userId),
            notInArray(paymentOrders.status, ['closed', 'pending']),
          ),
        );

      return {
        hasMore: input.offset + input.limit < countResult.length,
        orders: orders.map((order) => ({
          amount: order.amount,
          createdAt: order.createdAt.toISOString(),
          currency: order.currency,
          durationMonths: order.durationMonths,
          expiredAt: order.expiredAt.toISOString(),
          id: order.id,
          orderNo: order.orderNo,
          paidAt: order.paidAt?.toISOString(),
          payChannel: order.payChannel,
          planInterval: order.planInterval,
          planName: order.planName || '未知方案',
          planSlug: order.planSlug || '',
          status: order.status,
          subscriptionType: order.subscriptionType || 'recurring',
        })),
        total: countResult.length,
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
        amount: result.amount,
        orderNo: result.orderNo,
        paidAt: result.paidAt?.toISOString(),
        status: result.status,
      };
    }),
});
