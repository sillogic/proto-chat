/**
 * Payment Service - Main entry point
 * Orchestrates payment operations across different channels
 */

import type { DrizzleClient } from '@lobechat/database/client';
import { paymentOrders, subscriptionPlans } from '@lobechat/database';
import { eq, and } from 'drizzle-orm';

import type { PaymentChannel, PaymentConfig, CreateOrderInput, PaymentOrder } from './types';
import { WeChatNativeChannel } from './channels/wechat-native';
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

    // Future: Register other channels (Alipay, etc.)
    // if (config.alipay) {
    //   this.channels.set('alipay', new AlipayChannel(config.alipay));
    // }
  }

  /**
   * Create a new payment order
   * Returns order info with payment QR code URL
   */
  async createOrder(input: CreateOrderInput): Promise<{
    orderNo: string;
    codeUrl?: string;
    expiredAt: Date;
    amount: number;
  }> {
    const { userId, planId, planInterval, payChannel } = input;

    // 1. Get payment channel
    const channel = this.channels.get(payChannel);
    if (!channel) {
      throw new Error(`Payment channel ${payChannel} not supported`);
    }

    // 2. Query plan to determine amount (backend decides, don't trust frontend)
    const plan = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan || plan.length === 0) {
      throw new Error('Plan not found');
    }

    const planData = plan[0];
    const amount = planInterval === 'year' ? planData.yearlyPrice : planData.monthlyPrice;

    if (!amount || (planInterval === 'year' && !planData.yearlyPrice)) {
      throw new Error(`Plan does not support ${planInterval} billing`);
    }

    // 3. Check for existing pending order (avoid duplicate orders)
    const existingOrder = await this.db
      .select()
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.userId, userId),
          eq(paymentOrders.planId, planId),
          eq(paymentOrders.planInterval, planInterval),
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
          orderNo: order.orderNo,
          codeUrl,
          expiredAt: order.expiredAt,
          amount: order.amount,
        };
      }
    }

    // 4. Generate new order number
    const orderNo = generateOrderNo();

    // 5. Set expiration time (2 hours)
    const now = new Date();
    const expiredAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // 6. Create order in database
    const newOrder: Omit<PaymentOrder, 'createdAt' | 'updatedAt'> = {
      id: crypto.randomUUID(),
      orderNo,
      userId,
      planId,
      planInterval,
      amount,
      currency: 'CNY',
      payChannel,
      status: 'pending',
      expiredAt,
    };

    await this.db.insert(paymentOrders).values({
      id: newOrder.id,
      orderNo: newOrder.orderNo,
      userId: newOrder.userId,
      planId: newOrder.planId,
      planInterval: newOrder.planInterval,
      amount: newOrder.amount,
      currency: newOrder.currency,
      payChannel: newOrder.payChannel,
      status: newOrder.status,
      expiredAt: newOrder.expiredAt,
    });

    // 7. Call payment channel to create payment
    const channelResult = await channel.createPayment(newOrder as PaymentOrder);

    if (!channelResult.success) {
      // Update order status to closed if channel creation failed
      await this.db
        .update(paymentOrders)
        .set({ status: 'closed', closedAt: new Date() })
        .where(eq(paymentOrders.orderNo, orderNo));

      throw new Error(channelResult.errorMessage || 'Failed to create payment');
    }

    // 8. Update order with channel data
    await this.db
      .update(paymentOrders)
      .set({
        channelOrderNo: channelResult.channelOrderNo,
        channelData: channelResult.channelData,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.orderNo, orderNo));

    return {
      orderNo,
      codeUrl: channelResult.channelData?.code_url as string | undefined,
      expiredAt,
      amount,
    };
  }

  /**
   * Query order status
   */
  async queryOrder(orderNo: string): Promise<{
    orderNo: string;
    status: string;
    paidAt?: Date;
    amount: number;
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
      orderNo: orderData.orderNo,
      status: orderData.status,
      paidAt: orderData.paidAt || undefined,
      amount: orderData.amount,
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
        status: 'closed',
        closedAt: new Date(),
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
