import { useMemo } from 'react';

export interface PlanFeature {
  included: boolean;
  label: string;
  value?: string;
}

export interface PlanData {
  credits: string;
  deepseek: string;
  desc: string;
  features: PlanFeature[];
  fileStorage: string;
  gpt5Mini: string;
  id: string;
  name: string;
  popular?: boolean;
  price: {
    monthly: number;
    yearly: number;
  };
  vectorStorage: string;
  vectorStorageSize: string;
}

// 预留后端接口
const handleUpgrade = (planId: string) => {
  // TODO: 对接支付流程
  console.log('Upgrade to:', planId);
};

export const useSubscriptionPlans = () => {
  const plans: PlanData[] = useMemo(
    () => [
      {
        credits: '5,000,000',
        deepseek: '约 1,900 条',
        desc: 'personal.lite.desc',
        features: [],
        fileStorage: '1.0 GB',
        gpt5Mini: '约 7,000 条',
        id: 'lite',
        name: 'personal.lite.title',
        price: {
          monthly: 149,
          yearly: Math.round(149 * 12 * 0.8),
        },
        vectorStorage: '5,000 条',
        vectorStorageSize: '≈ 50MB',
      },
      {
        credits: '15,000,000',
        deepseek: '约 5,800 条',
        desc: 'personal.pro.desc',
        features: [],
        fileStorage: '2.0 GB',
        gpt5Mini: '约 21,100 条',
        id: 'pro',
        name: 'personal.pro.title',
        popular: true,
        price: {
          monthly: 299,
          yearly: Math.round(299 * 12 * 0.8),
        },
        vectorStorage: '10,000 条',
        vectorStorageSize: '≈ 100MB',
      },
      {
        credits: '35,000,000',
        deepseek: '约 13,400 条',
        desc: 'personal.ultra.desc',
        features: [],
        fileStorage: '4.0 GB',
        gpt5Mini: '约 49,100 条',
        id: 'ultra',
        name: 'personal.ultra.title',
        price: {
          monthly: 599,
          yearly: Math.round(599 * 12 * 0.8),
        },
        vectorStorage: '20,000 条',
        vectorStorageSize: '≈ 200MB',
      },
    ],
    [],
  );

  return {
    currentPlan: null,
    handleUpgrade,
    isLoading: false,
    plans,
  };
};
