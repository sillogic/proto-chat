import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { subscriptionPlans, userExtensions } from '@lobechat/database';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

// Features structure from plan document
export interface PlanFeatures {
  display?: {
    description?: string;
    model_estimates?: Array<{
      model: string;
      count: string;
    }>;
  };
  resources?: {
    credits_per_month?: string;
    file_storage_gb?: string;
    vector_storage?: string;
    vector_storage_display?: string;
  };
  cloud_services?: {
    unlimited_history?: boolean;
    global_sync?: boolean;
    web_search?: boolean;
  };
  support?: {
    level?: string;
  };
  capabilities?: {
    custom_api?: boolean;
    unlimited_messages?: boolean;
  };
}

export interface PlanResponse {
  id: string;
  name: string;
  slug: string;
  type: 'individual' | 'team';
  monthlyPrice: number;
  yearlyPrice: number | null;
  credits: string;
  storageLimit: number;
  vectorLimit: number;
  features: PlanFeatures;
  isPopular: boolean;
  displayOrder: number;
}

const subscriptionProcedure = publicProcedure.use(serverDatabase);
const authedSubscriptionProcedure = authedProcedure.use(serverDatabase);

export const subscriptionRouter = router({
  /**
   * Get all active subscription plans
   * Public endpoint - no authentication required
   */
  getPlans: subscriptionProcedure.query(async ({ ctx }): Promise<PlanResponse[]> => {
    const plans = await ctx.serverDB
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.displayOrder));

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      type: plan.type as 'individual' | 'team',
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      credits: plan.credits,
      storageLimit: plan.storageLimit,
      vectorLimit: plan.vectorLimit,
      features: plan.features as PlanFeatures,
      isPopular: plan.isPopular,
      displayOrder: plan.displayOrder,
    }));
  }),

  /**
   * Get current user's subscription status
   * Requires authentication
   */
  getCurrentPlan: authedSubscriptionProcedure.query(async ({ ctx }) => {
    // Query user extension to get current plan info
    const userExt = await ctx.serverDB
      .select()
      .from(userExtensions)
      .where(eq(userExtensions.userId, ctx.userId))
      .limit(1);

    if (!userExt || userExt.length === 0) {
      return null;
    }

    const user = userExt[0];

    // If user has a planId, fetch the full plan details
    if (user.planId) {
      const plan = await ctx.serverDB
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, user.planId))
        .limit(1);

      if (plan && plan.length > 0) {
        return {
          planId: user.planId,
          planSlug: user.currentPlan,
          planName: plan[0].name,
          planType: plan[0].type,
          billingInterval: user.billingInterval,
          planExpiresAt: user.planExpiresAt,
          nextCreditGrantAt: user.nextCreditGrantAt,
          features: plan[0].features,
        };
      }
    }

    // Fallback: user doesn't have a plan or plan not found
    return {
      planId: null,
      planSlug: user.currentPlan || 'free',
      planName: 'Free',
      planType: 'individual',
      billingInterval: null,
      planExpiresAt: user.planExpiresAt,
      nextCreditGrantAt: null,
      features: {},
    };
  }),
});
