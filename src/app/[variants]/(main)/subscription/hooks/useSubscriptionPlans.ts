import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { lambdaClient } from '@/libs/trpc/client';

// Features structure from backend
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
