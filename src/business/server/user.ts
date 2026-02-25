/* eslint-disable unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars */
import { Plans, type ReferralStatusString } from '@lobechat/types';
import { eq } from 'drizzle-orm';

import { serverDB } from '@lobechat/database';
import { userExtensions } from '@lobechat/database/schemas';

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
): Promise<void> {}
