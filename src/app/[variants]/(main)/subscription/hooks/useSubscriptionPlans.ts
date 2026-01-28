import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { lambdaClient } from '@/libs/trpc/client';

// Features structure from backend
export interface PlanFeatures {
  display: {
    description: string;
    support_level: 'community' | 'priority_email' | 'dedicated';
    model_estimates: Array<{
      model: string;
      count: string;
    }>;
    vector_storage_display: string;
  };
  capabilities: {
    custom_api: boolean;
    unlimited_messages: boolean;
    unlimited_history: boolean;
    global_sync: boolean;
    agent_market: boolean;
    premium_plugins: boolean;
    web_search: boolean;
    file_upload: boolean;
    tts: boolean;
  };
}

export interface PlanData {
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

export const useSubscriptionPlans = () => {
  // Fetch plans from backend
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryFn: () => lambdaClient.subscription.getPlans.query(),
    queryKey: ['subscription', 'plans'],
  });

  // Optionally fetch current plan (requires auth)
  const { data: currentPlan, isLoading: currentPlanLoading } = useQuery({
    queryFn: () => lambdaClient.subscription.getCurrentPlan.query(),
    queryKey: ['subscription', 'currentPlan'],
    retry: false, // Don't retry if user is not authenticated
  });

  const isLoading = plansLoading || currentPlanLoading;

  return {
    currentPlan,
    isLoading,
    plans,
  };
};
