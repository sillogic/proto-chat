/**
 * Payment Service - Main entry point
 * Orchestrates payment operations across different channels
 */

import type { DrizzleClient } from '@lobechat/database/client';
import { paymentOrders, subscriptionPlans } from '@lobechat/database';
import { eq, and } from 'drizzle-orm';

import type { PaymentChannel, PaymentConfig, CreateOrderInput, PaymentOrder } from './types';
import { WeChatNativeChannel } from './channels/wechat-native';
import { AlipayPrecreateChannel } from './channels/alipay-precreate';
import { generateOrderNo } from './utils/order-no';

export class PaymentService {
  private channels: Map<string, PaymentChannel> = new Map();
  private db: DrizzleClient;

  constructor(db: DrizzleClient, config: PaymentConfig) {
    this.db = db;

    // Register payment channels
    if (config.wechat) {
      this.channels.set('wechat_native', new WeChatNativeChannel(config.wechat));
    }

    if (config.alipay) {
      this.channels.set('alipay_precreate', new AlipayPrecreateChannel(config.alipay));
    }
  }

  /**
   * Create a new payment order
   * Returns order info with payment QR code URL
   */
  async createOrder(input: CreateOrderInput): Promise<{
    amount: number;
    codeUrl?: string;
    expiredAt: Date;
    orderNo: string;
  }> {
    const { userId, planId, planInterval, payChannel, subscriptionType, durationMonths } = input;

    // 1. Validate input parameters
    if (subscriptionType === 'onetime' && !durationMonths) {
      throw new Error('durationMonths is required for one-time payment');
    }

    if (subscriptionType === 'onetime' && ![1, 3, 6, 12].includes(durationMonths!)) {
      throw new Error('durationMonths must be 1, 3, 6, or 12');
    }

    if (subscriptionType === 'recurring' && durationMonths) {
      throw new Error('durationMonths should not be provided for recurring subscriptions');
    }

    // 2. Get payment channel
    const channel = this.channels.get(payChannel);
    if (!channel) {
      throw new Error(`Payment channel ${payChannel} not supported`);
    }

    // 3. Query plan to determine amount (backend decides, don't trust frontend)
    const plan = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan || plan.length === 0) {
      throw new Error('Plan not found');
    }

    const planData = plan[0];

    // 4. Calculate amount based on subscription type
    let amount: number;

    if (subscriptionType === 'onetime') {
      // One-time payment pricing
      if (durationMonths === 12) {
        // 12 months uses yearly price (same discount as yearly subscription)
        amount = planData.yearlyPrice || 0;
      } else {
        // 1, 3, 6 months use monthly price × duration
        amount = (planData.monthlyPrice || 0) * durationMonths!;
      }
    } else {
      // Recurring subscription pricing
      amount = planInterval === 'year' ? planData.yearlyPrice : planData.monthlyPrice;
    }

    if (!amount || amount <= 0) {
      throw new Error(`Invalid amount calculated for plan ${planId}`);
    }

    // 5. Check for existing pending order (avoid duplicate orders)
    const existingOrder = await this.db
      .select()
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.userId, userId),
          eq(paymentOrders.planId, planId),
          eq(paymentOrders.planInterval, planInterval),
          eq(paymentOrders.subscriptionType, subscriptionType),
          eq(paymentOrders.status, 'pending'),
        ),
      )
      .limit(1);

    // If there's an unexpired pending order, reuse it
    if (existingOrder && existingOrder.length > 0) {
      const order = existingOrder[0];
      if (order.expiredAt > new Date()) {
        const codeUrl = order.channelData?.code_url as string | undefined;
        return {
          amount: order.amount,
          codeUrl,
          expiredAt: order.expiredAt,
          orderNo: order.orderNo,
        };
      }
    }

    // 6. Generate new order number
    const orderNo = generateOrderNo();

    // 7. Set expiration time (2 hours)
    const now = new Date();
    const expiredAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // 8. Create order in database
    const newOrder: Omit<PaymentOrder, 'createdAt' | 'updatedAt'> = {
      amount,
      currency: 'CNY',
      durationMonths,
      expiredAt,
      id: crypto.randomUUID(),
      orderNo,
      payChannel,
      planId,
      planInterval,
      status: 'pending',
      subscriptionType,
      userId,
    };

    await this.db.insert(paymentOrders).values({
      amount: newOrder.amount,
      currency: newOrder.currency,
      durationMonths: newOrder.durationMonths,
      expiredAt: newOrder.expiredAt,
      id: newOrder.id,
      orderNo: newOrder.orderNo,
      payChannel: newOrder.payChannel,
      planId: newOrder.planId,
      planInterval: newOrder.planInterval,
      status: newOrder.status,
      subscriptionType: newOrder.subscriptionType,
      userId: newOrder.userId,
    });

    // 9. Call payment channel to create payment with plan metadata
    const channelResult = await channel.createPayment({
      ...(newOrder as PaymentOrder),
      planName: planData.name,
      planSlug: planData.slug,
    });

    if (!channelResult.success) {
      // Update order status to closed if channel creation failed
      await this.db
        .update(paymentOrders)
        .set({ closedAt: new Date(), status: 'closed' })
        .where(eq(paymentOrders.orderNo, orderNo));

      throw new Error(channelResult.errorMessage || 'Failed to create payment');
    }

    // 10. Update order with channel data
    await this.db
      .update(paymentOrders)
      .set({
        channelData: channelResult.channelData,
        channelOrderNo: channelResult.channelOrderNo,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.orderNo, orderNo));

    return {
      amount,
      codeUrl: channelResult.channelData?.code_url as string | undefined,
      expiredAt,
      orderNo,
    };
  }

  /**
   * Query order status
   */
  async queryOrder(orderNo: string): Promise<{
    amount: number;
    orderNo: string;
    paidAt?: Date;
    status: string;
  }> {
    const order = await this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderNo, orderNo))
      .limit(1);

    if (!order || order.length === 0) {
      throw new Error('Order not found');
    }

    const orderData = order[0];

    return {
      amount: orderData.amount,
      orderNo: orderData.orderNo,
      paidAt: orderData.paidAt || undefined,
      status: orderData.status,
    };
  }

  /**
   * Close an unpaid order
   */
  async closeOrder(orderNo: string, userId: string): Promise<void> {
    const order = await this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderNo, orderNo))
      .limit(1);

    if (!order || order.length === 0) {
      throw new Error('Order not found');
    }

    const orderData = order[0];

    // Verify user owns this order
    if (orderData.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Only close pending orders
    if (orderData.status !== 'pending') {
      return; // Already paid/closed
    }

    // Get channel and close order
    const channel = this.channels.get(orderData.payChannel);
    if (channel) {
      await channel.closeOrder(orderNo);
    }

    // Update database
    await this.db
      .update(paymentOrders)
      .set({
        closedAt: new Date(),
        status: 'closed',
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.orderNo, orderNo));
  }

  /**
   * Get channel for processing notifications
   */
  getChannel(channelName: string): PaymentChannel | undefined {
    return this.channels.get(channelName);
  }
}

// Export types
export * from './types';
