import { useQuery } from '@tanstack/react-query';

import { lambdaClient } from '@/libs/trpc/client';

// Features structure from backend
export interface PlanFeatures {
  capabilities?: {
    custom_api?: boolean;
    unlimited_messages?: boolean;
  };
  cloud_services?: {
    global_sync?: boolean;
    unlimited_history?: boolean;
    web_search?: boolean;
  };
  display?: {
    description?: string;
    model_estimates?: Array<{
      count: string;
      model: string;
    }>;
  };
  resources?: {
    credits_per_month?: string;
    file_storage_gb?: string;
    vector_storage?: string;
    vector_storage_display?: string;
  };
  support?: {
    level?: string;
  };
}

export interface PlanData {
  credits: string;
  displayOrder: number;
  features: PlanFeatures;
  id: string;
  isPopular: boolean;
  monthlyPrice: number;
  name: string;
  slug: string;
  storageLimit: number;
  type: 'individual' | 'team';
  vectorLimit: number;
  yearlyPrice: number | null;
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
