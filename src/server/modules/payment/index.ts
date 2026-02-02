/**
 * Payment Service - Main entry point
 * Orchestrates payment operations across different channels
 */

import { paymentOrders, subscriptionPlans, userAgreements } from '@lobechat/database';
import type { LobeChatDatabase } from '@lobechat/database';
import { eq, and } from 'drizzle-orm';

import type { PaymentChannel, PaymentConfig, CreateOrderInput, PaymentOrder } from './types';
import { WeChatNativeChannel } from './channels/wechat-native';
import { AlipayPrecreateChannel } from './channels/alipay-precreate';
import { AlipayCycleChannel } from './channels/alipay-cycle';
import { generateOrderNo } from './utils/order-no';

export class PaymentService {
  private channels: Map<string, PaymentChannel> = new Map();
  private cycleChannel: AlipayCycleChannel | null = null;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, config: PaymentConfig) {
    this.db = db;

    // Register payment channels
    if (config.wechat) {
      this.channels.set('wechat_native', new WeChatNativeChannel(config.wechat));
    }

    if (config.alipay) {
      this.channels.set('alipay_precreate', new AlipayPrecreateChannel(config.alipay));
      // Also initialize cycle channel for recurring payments
      this.cycleChannel = new AlipayCycleChannel(config.alipay);
    }
  }

  /**
   * Get the cycle channel for recurring payments
   */
  getCycleChannel(): AlipayCycleChannel | null {
    return this.cycleChannel;
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
      amount = (planInterval === 'year' ? planData.yearlyPrice : planData.monthlyPrice) || 0;
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
        const channelData = (order.channelData as Record<string, unknown>) || {};
        const codeUrl = channelData.code_url as string | undefined;
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

  /**
   * Create a sign + pay order for recurring subscriptions
   * This creates both a payment order and an agreement record
   */
  async createSignPaymentOrder(input: {
    billingInterval: 'month' | 'year';
    planId: string;
    userId: string;
  }): Promise<{
    agreementId: string;
    amount: number;
    codeUrl?: string;
    expiredAt: Date;
    externalAgreementNo: string;
    orderNo: string;
  }> {
    const { userId, planId, billingInterval } = input;

    if (!this.cycleChannel) {
      throw new Error('Alipay cycle payment is not configured');
    }

    // 1. Query plan to determine amount
    const plan = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan || plan.length === 0) {
      throw new Error('Plan not found');
    }

    const planData = plan[0];
    const amount = (billingInterval === 'year' ? planData.yearlyPrice : planData.monthlyPrice) || 0;

    if (!amount || amount <= 0) {
      throw new Error(`Invalid amount calculated for plan ${planId}`);
    }

    // 2. Generate order number and external agreement number
    const orderNo = generateOrderNo();
    const externalAgreementNo = `AGR${orderNo}`;

    // 3. Set expiration time (2 hours)
    const now = new Date();
    const expiredAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // 4. Calculate period params
    const periodType = 'MONTH' as const;
    const period = billingInterval === 'year' ? 12 : 1;

    // 5. Create agreement record (pending status)
    const agreementId = crypto.randomUUID();
    await this.db.insert(userAgreements).values({
      billingInterval,
      externalAgreementNo,
      firstOrderNo: orderNo,
      id: agreementId,
      period,
      periodType,
      planId,
      planName: planData.name,
      planSlug: planData.slug,
      signChannel: 'alipay',
      signScene: 'INDUSTRY|DIGITAL_MEDIA',
      singleAmount: amount,
      status: 'pending',
      userId,
    });

    // 6. Create payment order record
    await this.db.insert(paymentOrders).values({
      amount,
      currency: 'CNY',
      expiredAt,
      id: crypto.randomUUID(),
      orderNo,
      payChannel: 'alipay_cycle',
      planId,
      planInterval: billingInterval,
      status: 'pending',
      subscriptionType: 'recurring',
      userId,
    });

    // 7. Call Alipay to create sign + payment
    const result = await this.cycleChannel.createSignPayment({
      agreementParams: {
        accessChannel: 'QRCODE',
        billingInterval,
        externalAgreementNo,
        period,
        periodType,
        planName: planData.name,
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        singleAmount: amount,
      },
      amount,
      orderNo,
      subject: `${planData.name} ${billingInterval === 'year' ? '连续包年' : '连续包月'}`,
    });

    if (!result.success) {
      // Update order status to closed if channel creation failed
      await this.db
        .update(paymentOrders)
        .set({ closedAt: new Date(), status: 'closed' })
        .where(eq(paymentOrders.orderNo, orderNo));

      await this.db
        .update(userAgreements)
        .set({ status: 'unsigned', updatedAt: new Date() })
        .where(eq(userAgreements.id, agreementId));

      throw new Error(result.errorMessage || 'Failed to create sign payment');
    }

    return {
      agreementId,
      amount,
      codeUrl: result.codeUrl,
      expiredAt,
      externalAgreementNo,
      orderNo,
    };
  }

  /**
   * Process sign notification from Alipay
   * Called when user successfully signs the agreement
   */
  async processSignNotification(data: {
    agreementNo: string;
    alipayLogonId?: string;
    alipayOpenId?: string;
    alipayUserId?: string;
    externalAgreementNo: string;
    signScene: string;
    signTime: Date;
    status: 'NORMAL' | 'UNSIGN';
  }): Promise<{ success: boolean }> {
    const {
      externalAgreementNo,
      agreementNo,
      status,
      signTime,
      alipayUserId,
      alipayOpenId,
      alipayLogonId,
    } = data;

    // Find the agreement by external agreement number
    const agreement = await this.db
      .select()
      .from(userAgreements)
      .where(eq(userAgreements.externalAgreementNo, externalAgreementNo))
      .limit(1);

    if (!agreement || agreement.length === 0) {
      console.error('[PaymentService] Agreement not found:', externalAgreementNo);
      return { success: false };
    }

    const agreementData = agreement[0];

    if (status === 'NORMAL') {
      // Calculate next deduct date
      const nextDeductDate = new Date(signTime);
      if (agreementData.periodType === 'MONTH') {
        nextDeductDate.setMonth(nextDeductDate.getMonth() + agreementData.period);
        if (nextDeductDate.getDate() > 28) {
          nextDeductDate.setDate(28);
        }
      } else {
        nextDeductDate.setDate(nextDeductDate.getDate() + agreementData.period);
      }

      // Update agreement to signed status
      await this.db
        .update(userAgreements)
        .set({
          agreementNo,
          alipayLogonId,
          alipayOpenId,
          alipayUserId,
          nextDeductDate: nextDeductDate.toISOString().split('T')[0],
          signTime,
          status: 'signed',
          updatedAt: new Date(),
        })
        .where(eq(userAgreements.id, agreementData.id));

      console.log('[PaymentService] Agreement signed successfully:', agreementNo);
    } else if (status === 'UNSIGN') {
      // Update agreement to unsigned status
      await this.db
        .update(userAgreements)
        .set({
          status: 'unsigned',
          unsignReason: 'user_unsign',
          unsignTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userAgreements.id, agreementData.id));

      console.log('[PaymentService] Agreement unsigned:', agreementNo);
    }

    return { success: true };
  }

  /**
   * Perform deduct payment using agreement
   * Called by cron job for auto-renewal
   */
  async deductPayment(input: {
    agreementNo: string;
    amount: number;
    planName: string;
    userId: string;
  }): Promise<{
    errorCode?: string;
    errorMessage?: string;
    orderNo: string;
    status: 'success' | 'failed' | 'pending';
  }> {
    if (!this.cycleChannel) {
      throw new Error('Alipay cycle payment is not configured');
    }

    const { agreementNo, amount, planName, userId } = input;

    // Generate new order number for deduct
    const orderNo = generateOrderNo();
    const now = new Date();
    const expiredAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Create payment order record
    await this.db.insert(paymentOrders).values({
      amount,
      currency: 'CNY',
      expiredAt,
      id: crypto.randomUUID(),
      orderNo,
      payChannel: 'alipay_cycle_deduct',
      planId: '', // Will be filled from agreement
      planInterval: 'month',
      status: 'pending',
      subscriptionType: 'recurring',
      userId,
    });

    // Call Alipay to deduct
    const result = await this.cycleChannel.deductPayment({
      agreementNo,
      amount,
      orderNo,
      subject: `${planName} 自动续费`,
    });

    // Update order status based on result
    if (result.status === 'success') {
      await this.db
        .update(paymentOrders)
        .set({
          channelOrderNo: result.channelOrderNo,
          paidAt: new Date(),
          status: 'paid',
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.orderNo, orderNo));
    } else if (result.status === 'failed') {
      await this.db
        .update(paymentOrders)
        .set({
          channelData: { errorCode: result.errorCode, errorMessage: result.errorMessage },
          closedAt: new Date(),
          status: 'closed',
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.orderNo, orderNo));
    }

    return {
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      orderNo,
      status: result.status,
    };
  }

  /**
   * Unsign an agreement (cancel auto-renewal)
   */
  async unsignAgreement(agreementId: string, userId: string): Promise<{ success: boolean }> {
    if (!this.cycleChannel) {
      throw new Error('Alipay cycle payment is not configured');
    }

    // Find agreement
    const agreement = await this.db
      .select()
      .from(userAgreements)
      .where(and(eq(userAgreements.id, agreementId), eq(userAgreements.userId, userId)))
      .limit(1);

    if (!agreement || agreement.length === 0) {
      throw new Error('Agreement not found');
    }

    const agreementData = agreement[0];

    if (!agreementData.agreementNo) {
      throw new Error('Agreement not signed yet');
    }

    if (agreementData.status !== 'signed') {
      throw new Error('Agreement is not active');
    }

    // Call Alipay to unsign
    const result = await this.cycleChannel.unsignAgreement(agreementData.agreementNo);

    if (result.success) {
      // Update agreement status
      await this.db
        .update(userAgreements)
        .set({
          status: 'unsigned',
          unsignReason: 'merchant_unsign',
          unsignTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userAgreements.id, agreementId));
    }

    return result;
  }
}

// Export types
export * from './types';
