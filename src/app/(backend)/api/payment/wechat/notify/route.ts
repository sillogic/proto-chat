/**
 * WeChat Pay Notification Callback Handler
 * Handles payment success notifications from WeChat Pay
 */

import { serverDB } from '@/database/client';
import {
  paymentNotifications,
  paymentOrders,
  subscriptionPlans,
  userBalances,
  userExtensions,
  userSubscriptionHistory,
  userTransactions,
} from '@lobechat/database';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { WeChatNativeChannel } from '@/server/modules/payment/channels/wechat-native';

// Helper to build XML response
function buildXmlResponse(returnCode: 'SUCCESS' | 'FAIL', returnMsg?: string): string {
  return `<xml>
  <return_code><![CDATA[${returnCode}]]></return_code>
  ${returnMsg ? `<return_msg><![CDATA[${returnMsg}]]></return_msg>` : ''}
</xml>`;
}

// Helper to calculate expiration date
function calculateExpiresAt(billingInterval: 'month' | 'year'): Date {
  const now = new Date();
  const expiresAt = new Date(now);

  if (billingInterval === 'year') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  return expiresAt;
}

// Helper to calculate next credit grant date (1 month from now)
function calculateNextCreditGrantAt(): Date {
  const now = new Date();
  const nextGrant = new Date(now);
  nextGrant.setMonth(nextGrant.getMonth() + 1);
  return nextGrant;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body
    const rawBody = await request.text();

    // 2. Initialize WeChat channel for signature verification
    const wechatConfig = {
      appId: process.env.WECHAT_PAY_APP_ID || '',
      mchId: process.env.WECHAT_PAY_MCH_ID || '',
      apiKey: process.env.WECHAT_PAY_API_KEY || '',
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
    };

    if (!wechatConfig.appId || !wechatConfig.mchId || !wechatConfig.apiKey) {
      console.error('WeChat Pay configuration is incomplete');
      return new NextResponse(buildXmlResponse('FAIL', 'Configuration error'), {
        headers: { 'Content-Type': 'application/xml' },
        status: 500,
      });
    }

    const wechatChannel = new WeChatNativeChannel(wechatConfig);

    // 3. Parse and verify notification
    const notificationResult = await wechatChannel.parseNotification(rawBody);

    // Log all notifications for audit
    await serverDB.insert(paymentNotifications).values({
      id: crypto.randomUUID(),
      orderNo: notificationResult.orderNo || 'unknown',
      payChannel: 'wechat_native',
      rawData: rawBody,
      status: notificationResult.success ? 'success' : 'fail',
    });

    if (!notificationResult.success) {
      console.error('Failed to parse notification:', notificationResult.errorMessage);
      return new NextResponse(buildXmlResponse('FAIL', notificationResult.errorMessage), {
        headers: { 'Content-Type': 'application/xml' },
        status: 400,
      });
    }

    const { orderNo, channelOrderNo, paidAt, amount } = notificationResult;

    // 4. Query payment order
    const orderResult = await serverDB
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderNo, orderNo))
      .limit(1);

    if (!orderResult || orderResult.length === 0) {
      console.error('Order not found:', orderNo);
      return new NextResponse(buildXmlResponse('FAIL', 'Order not found'), {
        headers: { 'Content-Type': 'application/xml' },
        status: 404,
      });
    }

    const order = orderResult[0];

    // 5. Idempotency check: if already paid, return success immediately
    if (order.status === 'paid') {
      console.log('Order already paid, returning success:', orderNo);
      return new NextResponse(buildXmlResponse('SUCCESS'), {
        headers: { 'Content-Type': 'application/xml' },
        status: 200,
      });
    }

    // 6. Verify amount matches
    if (amount && amount !== order.amount) {
      console.error('Amount mismatch:', { expected: order.amount, received: amount });
      await serverDB.insert(paymentNotifications).values({
        id: crypto.randomUUID(),
        orderNo,
        payChannel: 'wechat_native',
        rawData: `Amount mismatch: expected ${order.amount}, received ${amount}`,
        status: 'fail',
      });
      return new NextResponse(buildXmlResponse('FAIL', 'Amount mismatch'), {
        headers: { 'Content-Type': 'application/xml' },
        status: 400,
      });
    }

    // 7. Process payment success in a transaction
    await serverDB.transaction(async (tx) => {
      // 7a. Update payment order
      await tx
        .update(paymentOrders)
        .set({
          status: 'paid',
          paidAt: paidAt || new Date(),
          channelOrderNo,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.orderNo, orderNo));

      // 7b. Query plan details
      const planResult = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, order.planId))
        .limit(1);

      if (!planResult || planResult.length === 0) {
        throw new Error(`Plan not found: ${order.planId}`);
      }

      const plan = planResult[0];

      // 7c. Calculate dates
      const now = new Date();
      const expiresAt = calculateExpiresAt(order.planInterval);
      const nextCreditGrantAt = calculateNextCreditGrantAt();

      // 7d. Update or insert user_extensions
      const existingUserExt = await tx
        .select()
        .from(userExtensions)
        .where(eq(userExtensions.userId, order.userId))
        .limit(1);

      if (existingUserExt && existingUserExt.length > 0) {
        // Update existing record
        await tx
          .update(userExtensions)
          .set({
            currentPlan: plan.slug,
            planId: plan.id,
            planExpiresAt: expiresAt,
            billingInterval: order.planInterval,
            nextCreditGrantAt,
            updatedAt: now,
          })
          .where(eq(userExtensions.userId, order.userId));
      } else {
        // Insert new record
        await tx.insert(userExtensions).values({
          id: crypto.randomUUID(),
          userId: order.userId,
          currentPlan: plan.slug,
          planId: plan.id,
          planExpiresAt: expiresAt,
          billingInterval: order.planInterval,
          nextCreditGrantAt,
          createdAt: now,
          updatedAt: now,
        });
      }

      // 7e. Write subscription history
      const price = order.planInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
      await tx.insert(userSubscriptionHistory).values({
        id: crypto.randomUUID(),
        userId: order.userId,
        planId: plan.id,
        planSlug: plan.slug,
        status: 'active',
        price: price || order.amount,
        billingInterval: order.planInterval,
        orderNo,
        startDate: now,
        endDate: expiresAt,
        createdAt: now,
      });

      // 7f. Grant credits - Reset balance to plan credits
      const existingBalance = await tx
        .select()
        .from(userBalances)
        .where(eq(userBalances.userId, order.userId))
        .limit(1);

      const credits = Number.parseInt(plan.credits, 10);

      if (existingBalance && existingBalance.length > 0) {
        // Update balance
        await tx
          .update(userBalances)
          .set({
            balance: credits,
            updatedAt: now,
          })
          .where(eq(userBalances.userId, order.userId));
      } else {
        // Insert new balance
        await tx.insert(userBalances).values({
          id: crypto.randomUUID(),
          userId: order.userId,
          balance: credits,
          createdAt: now,
          updatedAt: now,
        });
      }

      // 7g. Write transaction record
      await tx.insert(userTransactions).values({
        id: crypto.randomUUID(),
        userId: order.userId,
        type: 'SUBSCRIPTION_GRANT',
        category: 'SUBSCRIPTION_PURCHASE',
        amount: credits,
        balanceAfter: credits,
        metadata: {
          orderNo,
          planId: plan.id,
          planSlug: plan.slug,
          billingInterval: order.planInterval,
        },
        createdAt: now,
      });
    });

    // 8. Return success response
    console.log('Payment processed successfully:', orderNo);
    return new NextResponse(buildXmlResponse('SUCCESS'), {
      headers: { 'Content-Type': 'application/xml' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing WeChat payment notification:', error);
    return new NextResponse(buildXmlResponse('FAIL', 'Internal error'), {
      headers: { 'Content-Type': 'application/xml' },
      status: 500,
    });
  }
}
