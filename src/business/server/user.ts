/* eslint-disable unused-imports/no-unused-vars */
import { serverDB } from '@lobechat/database';
import {
  subscriptionPlans,
  userBalances,
  userExtensions,
  userTransactions,
} from '@lobechat/database/schemas';
import { Plans, type ReferralStatusString } from '@lobechat/types';
import { eq } from 'drizzle-orm';

import { AgentService } from '@/server/services/agent';

export async function getReferralStatus(userId: string): Promise<ReferralStatusString | undefined> {
  return undefined;
}

export async function getSubscriptionPlan(userId: string): Promise<Plans> {
  try {
    const extension = await serverDB.query.userExtensions.findFirst({
      where: eq(userExtensions.userId, userId),
    });

    if (!extension || !extension.currentPlan) {
      return Plans.Free;
    }

    const planSlug = extension.currentPlan.toLowerCase();

    // Map common plan slugs to Plans enum
    const planMapping: Record<string, Plans> = {
      'free': Plans.Free,
      'free-trial': Plans.Free,
      'hobby': Plans.Hobby,
      'lite': Plans.Hobby,
      'basic': Plans.Hobby,
      'starter': Plans.Starter,
      'pro': Plans.Premium,
      'professional': Plans.Premium,
      'premium': Plans.Premium,
      'ultimate': Plans.Ultimate,
      'enterprise': Plans.Ultimate,
    };

    // Return mapped value if exists, otherwise check if it's a valid Plans value
    if (planMapping[planSlug]) {
      return planMapping[planSlug];
    }

    const planValue = extension.currentPlan as Plans;
    if (Object.values(Plans).includes(planValue)) {
      return planValue;
    }

    // Fallback to Free for unknown plans
    return Plans.Free;
  } catch (error) {
    console.error('Error fetching subscription plan:', error);
    return Plans.Free;
  }
}

export async function getIsInviteCodeRequired(userId: string): Promise<boolean> {
  return false;
}

export async function initNewUserForBusiness(
  userId: string,
  createdAt: Date | null | undefined,
): Promise<void> {
  // Step 1: Create inbox
  const agentService = new AgentService(serverDB, userId);
  await agentService.createInbox();

  // Step 2: Look up the free plan
  const freePlan = await serverDB
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.slug, 'free'))
    .limit(1)
    .then((rows) => rows[0]);

  if (!freePlan) {
    console.warn(`[initNewUserForBusiness] Free plan not found, user ${userId} will have no initial credits`);
  } else {
    // Step 3: Create userExtensions record with free plan
    const nextCreditGrantAt = new Date();
    nextCreditGrantAt.setMonth(nextCreditGrantAt.getMonth() + 1);

    await serverDB
      .insert(userExtensions)
      .values({
        currentPlan: freePlan.slug,
        nextCreditGrantAt,
        planId: freePlan.id,
        subscriptionType: 'recurring',
        userId,
      })
      .onConflictDoNothing();
  }

  // Step 4: Initialize user balance with free plan credits (or 0 if no plan found)
  const initialCredits = freePlan?.credits ? parseFloat(freePlan.credits) : 0;

  await serverDB
    .insert(userBalances)
    .values({
      balance: initialCredits.toFixed(4),
      totalPurchased: '0',
      userId,
    })
    .onConflictDoNothing();

  // Step 5: Record initial credit grant transaction
  if (initialCredits > 0) {
    await serverDB.insert(userTransactions).values({
      amount: initialCredits.toFixed(4),
      balanceAfter: initialCredits.toFixed(4),
      category: 'SUBSCRIPTION_GRANT',
      description: `Initial Free plan credits: ${initialCredits}`,
      type: 'SUBSCRIPTION_GRANT',
      userId,
    });
  }
}
