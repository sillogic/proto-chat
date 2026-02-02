/**
 * Alipay Sign Notification Callback Handler
 * Handles agreement sign/unsign notifications from Alipay
 *
 * This is called when:
 * - User successfully signs the recurring payment agreement (dut_user_sign)
 * - User unsigns the agreement from Alipay app (dut_user_unsign)
 */

import {
  paymentNotifications,
  paymentOrders,
  serverDB,
  subscriptionPlans,
  userAgreements,
  userBalances,
  userExtensions,
  userSubscriptionHistory,
  userTransactions,
} from '@lobechat/database';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { AlipayCycleChannel } from '@/server/modules/payment/channels/alipay-cycle';

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
    console.log('[Alipay Sign Notify] Received notification');

    // 2. Initialize Alipay cycle channel for parsing
    const alipayConfig = {
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
      appId: process.env.ALIPAY_APP_ID || '',
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
      sandbox: process.env.ALIPAY_SANDBOX === 'true',
      signNotifyUrl: process.env.ALIPAY_SIGN_NOTIFY_URL || '',
    };

    if (!alipayConfig.appId || !alipayConfig.privateKey || !alipayConfig.alipayPublicKey) {
      console.error('[Alipay Sign Notify] Configuration is incomplete');
      return new NextResponse('fail', {
        headers: { 'Content-Type': 'text/plain' },
        status: 500,
      });
    }

    const cycleChannel = new AlipayCycleChannel(alipayConfig);

    // 3. Parse notification
    const signResult = cycleChannel.parseSignNotification(rawBody);

    // Log notification for audit
    await serverDB.insert(paymentNotifications).values({
      id: crypto.randomUUID(),
      orderNo: signResult?.externalAgreementNo || 'unknown',
      payChannel: 'alipay_cycle_sign',
      rawData: rawBody,
      status: signResult?.success ? 'success' : 'fail',
    });

    if (!signResult || !signResult.success) {
      console.error('[Alipay Sign Notify] Failed to parse notification');
      return new NextResponse('fail', {
        headers: { 'Content-Type': 'text/plain' },
        status: 400,
      });
    }

    const {
      externalAgreementNo,
      agreementNo,
      status,
      signTime,
      alipayUserId,
      alipayOpenId,
      alipayLogonId,
    } = signResult;

    console.log('[Alipay Sign Notify] Parsed:', {
      agreementNo,
      externalAgreementNo,
      status,
    });

    // 4. Find agreement record
    const agreementResult = await serverDB
      .select()
      .from(userAgreements)
      .where(eq(userAgreements.externalAgreementNo, externalAgreementNo))
      .limit(1);

    if (!agreementResult || agreementResult.length === 0) {
      console.error('[Alipay Sign Notify] Agreement not found:', externalAgreementNo);
      return new NextResponse('fail', {
        headers: { 'Content-Type': 'text/plain' },
        status: 404,
      });
    }

    const agreement = agreementResult[0];

    // 5. Handle based on status
    if (status === 'NORMAL') {
      // User signed successfully
      console.log('[Alipay Sign Notify] Processing sign success');

      // Calculate next deduct date
      const nextDeductDate = new Date(signTime);
      if (agreement.periodType === 'MONTH') {
        nextDeductDate.setMonth(nextDeductDate.getMonth() + agreement.period);
        if (nextDeductDate.getDate() > 28) {
          nextDeductDate.setDate(28);
        }
      } else {
        nextDeductDate.setDate(nextDeductDate.getDate() + agreement.period);
      }

      // Process in transaction
      await serverDB.transaction(async (tx) => {
        // 5a. Update agreement to signed
        await tx
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
          .where(eq(userAgreements.id, agreement.id));

        // 5b. Find and update the first payment order
        if (agreement.firstOrderNo) {
          const orderResult = await tx
            .select()
            .from(paymentOrders)
            .where(eq(paymentOrders.orderNo, agreement.firstOrderNo))
            .limit(1);

          if (orderResult && orderResult.length > 0) {
            const order = orderResult[0];

            // Skip if already paid
            if (order.status === 'paid') {
              console.log('[Alipay Sign Notify] Order already paid, skipping');
              return;
            }

            // Update order to paid
            await tx
              .update(paymentOrders)
              .set({
                paidAt: signTime,
                status: 'paid',
                updatedAt: new Date(),
              })
              .where(eq(paymentOrders.orderNo, agreement.firstOrderNo));

            // 5c. Query plan details
            const planResult = await tx
              .select()
              .from(subscriptionPlans)
              .where(eq(subscriptionPlans.id, agreement.planId))
              .limit(1);

            if (!planResult || planResult.length === 0) {
              throw new Error(`Plan not found: ${agreement.planId}`);
            }

            const plan = planResult[0];
            const now = new Date();
            const billingInterval = agreement.billingInterval as 'month' | 'year';
            const expiresAt = calculateExpiresAt(billingInterval);
            const nextCreditGrantAt = calculateNextCreditGrantAt();

            // 5d. Update user_extensions
            const existingUserExt = await tx
              .select()
              .from(userExtensions)
              .where(eq(userExtensions.userId, agreement.userId))
              .limit(1);

            if (existingUserExt && existingUserExt.length > 0) {
              await tx
                .update(userExtensions)
                .set({
                  autoRenew: true,
                  billingInterval,
                  currentAgreementId: agreement.id,
                  currentPlan: plan.slug,
                  downgradeAt: null,
                  downgradeReason: null,
                  nextCreditGrantAt,
                  planExpiresAt: expiresAt,
                  planId: plan.id,
                  previousPlanName: null,
                  previousPlanSlug: null,
                  subscriptionType: 'recurring',
                  updatedAt: now,
                })
                .where(eq(userExtensions.userId, agreement.userId));
            } else {
              await tx.insert(userExtensions).values({
                autoRenew: true,
                billingInterval,
                createdAt: now,
                currentAgreementId: agreement.id,
                currentPlan: plan.slug,
                id: crypto.randomUUID(),
                nextCreditGrantAt,
                planExpiresAt: expiresAt,
                planId: plan.id,
                subscriptionType: 'recurring',
                updatedAt: now,
                userId: agreement.userId,
              });
            }

            // 5e. Write subscription history
            const price =
              billingInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
            await tx.insert(userSubscriptionHistory).values({
              autoRenew: true,
              billingInterval,
              createdAt: now,
              endedAt: expiresAt,
              id: crypto.randomUUID(),
              orderNo: agreement.firstOrderNo,
              planId: plan.id,
              planName: plan.name,
              planType: plan.type,
              price: price || order.amount,
              slug: plan.slug,
              startedAt: now,
              status: 'active',
              subscriptionType: 'recurring',
              userId: agreement.userId,
            });

            // 5f. Grant credits
            const existingBalance = await tx
              .select()
              .from(userBalances)
              .where(eq(userBalances.userId, agreement.userId))
              .limit(1);

            const credits = Number.parseInt(plan.credits, 10);

            if (existingBalance && existingBalance.length > 0) {
              await tx
                .update(userBalances)
                .set({
                  balance: String(credits),
                  updatedAt: now,
                })
                .where(eq(userBalances.userId, agreement.userId));
            } else {
              await tx.insert(userBalances).values({
                balance: String(credits),
                createdAt: now,
                updatedAt: now,
                userId: agreement.userId,
              });
            }

            // 5g. Write transaction record
            await tx.insert(userTransactions).values({
              amount: String(credits),
              balanceAfter: String(credits),
              category: 'SUBSCRIPTION_PURCHASE',
              createdAt: now,
              id: crypto.randomUUID(),
              metadata: {
                agreementNo,
                billingInterval,
                orderNo: agreement.firstOrderNo,
                planId: plan.id,
                planSlug: plan.slug,
                type: 'sign_and_pay',
              },
              type: 'SUBSCRIPTION_GRANT',
              userId: agreement.userId,
            });
          }
        }
      });

      console.log('[Alipay Sign Notify] Sign processed successfully:', agreementNo);
    } else if (status === 'UNSIGN') {
      // User unsigned (from Alipay app)
      console.log('[Alipay Sign Notify] Processing unsign');

      await serverDB.transaction(async (tx) => {
        // Update agreement status
        await tx
          .update(userAgreements)
          .set({
            status: 'unsigned',
            unsignReason: 'user_unsign',
            unsignTime: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userAgreements.id, agreement.id));

        // Update user_extensions to disable auto-renew
        await tx
          .update(userExtensions)
          .set({
            autoRenew: false,
            currentAgreementId: null,
            updatedAt: new Date(),
          })
          .where(eq(userExtensions.userId, agreement.userId));
      });

      console.log('[Alipay Sign Notify] Unsign processed successfully:', agreementNo);
    }

    // Return success
    return new NextResponse('success', {
      headers: { 'Content-Type': 'text/plain' },
      status: 200,
    });
  } catch (error) {
    console.error('[Alipay Sign Notify] Error:', error);
    return new NextResponse('fail', {
      headers: { 'Content-Type': 'text/plain' },
      status: 500,
    });
  }
}
