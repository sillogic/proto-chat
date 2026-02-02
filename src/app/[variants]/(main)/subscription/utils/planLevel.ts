/**
 * 方案等级计算工具
 *
 * 等级计算公式：方案等级 = 方案类型等级 × 100 + 付费周期优先级
 *
 * 方案类型等级：
 * - Free: 0
 * - Lite: 1
 * - Pro: 2
 * - Ultra: 3
 *
 * 付费周期优先级：
 * - 一次性付费（1个月）: 1
 * - 连续包月: 2
 * - 一次性付费（3个月）: 3
 * - 一次性付费（6个月）: 4
 * - 一次性付费（12个月）: 5
 * - 连续包年: 6
 */

// 方案类型等级映射
export const PLAN_TYPE_LEVEL: Record<string, number> = {
  free: 0,
  lite: 1,
  pro: 2,
  ultra: 3,
};

// 付费周期优先级
export const BILLING_CYCLE_PRIORITY = {
  onetime_1: 1, 
  
// 一次性付费（6个月）
onetime_12: 5, 
  

// 连续包月
onetime_3: 3, 
  

// 一次性付费（3个月）
onetime_6: 4, 
  
// 一次性付费（1个月）
recurring_month: 2, // 一次性付费（12个月）
  recurring_year: 6, // 连续包年
};

export interface PlanLevelParams {
  billingInterval?: 'month' | 'year' | null;
  // 循环订阅时使用
  durationMonths?: number | null;
  planSlug: string; 
  subscriptionType: 'recurring' | 'onetime'; // 一次性付费时使用
}

/**
 * 获取付费周期优先级
 */
export function getBillingCyclePriority(
  subscriptionType: 'recurring' | 'onetime',
  billingInterval?: 'month' | 'year' | null,
  durationMonths?: number | null,
): number {
  if (subscriptionType === 'recurring') {
    return billingInterval === 'year'
      ? BILLING_CYCLE_PRIORITY.recurring_year
      : BILLING_CYCLE_PRIORITY.recurring_month;
  }

  // 一次性付费
  switch (durationMonths ?? 1) {
    case 1: {
      return BILLING_CYCLE_PRIORITY.onetime_1;
    }
    case 3: {
      return BILLING_CYCLE_PRIORITY.onetime_3;
    }
    case 6: {
      return BILLING_CYCLE_PRIORITY.onetime_6;
    }
    case 12: {
      return BILLING_CYCLE_PRIORITY.onetime_12;
    }
    default: {
      // 其他月数按最接近的向下取
      const months = durationMonths!;
      if (months < 3) return BILLING_CYCLE_PRIORITY.onetime_1;
      if (months < 6) return BILLING_CYCLE_PRIORITY.onetime_3;
      if (months < 12) return BILLING_CYCLE_PRIORITY.onetime_6;
      return BILLING_CYCLE_PRIORITY.onetime_12;
    }
  }
}

/**
 * 计算方案等级
 * @returns 等级值，越大等级越高
 */
export function calculatePlanLevel(params: PlanLevelParams): number {
  const planTypeLevel = PLAN_TYPE_LEVEL[params.planSlug.toLowerCase()] ?? 0;
  const billingPriority = getBillingCyclePriority(
    params.subscriptionType,
    params.billingInterval,
    params.durationMonths,
  );

  return planTypeLevel * 100 + billingPriority;
}

/**
 * 比较两个方案的等级
 * @returns 正数表示 a > b，负数表示 a < b，0 表示相等
 */
export function comparePlanLevel(a: PlanLevelParams, b: PlanLevelParams): number {
  return calculatePlanLevel(a) - calculatePlanLevel(b);
}

/**
 * 判断目标方案是否可以从当前方案升级
 * @param current 当前方案
 * @param target 目标方案
 * @returns { canUpgrade: boolean, isCurrentPlan: boolean, isSameLevelOrLower: boolean }
 *
 * 升级规则：
 * 1. 跨方案类型升级（如 Pro -> Ultra）：需要目标付费周期至少达到当前付费周期的等效水平
 *    - 当前为月付（一次性1月或连续包月）：任何付费周期都可升级
 *    - 当前为季付/半年付（一次性3/6月）：目标付费周期优先级 >= 当前优先级
 *    - 当前为年付（一次性12月或连续包年）：目标必须是一次性12月或连续包年
 * 2. 同方案类型升级：目标付费周期优先级必须 > 当前优先级
 */
export function checkUpgradeEligibility(
  current: PlanLevelParams | null,
  target: PlanLevelParams,
): {
  canUpgrade: boolean;
  isCurrentPlan: boolean;
  isSameLevelOrLower: boolean;
} {
  // 如果没有当前方案（Free），任何付费方案都可以购买
  if (!current || current.planSlug === 'free') {
    return {
      canUpgrade: true,
      isCurrentPlan: false,
      isSameLevelOrLower: false,
    };
  }

  const currentLevel = calculatePlanLevel(current);
  const targetLevel = calculatePlanLevel(target);

  // 获取方案类型等级
  const currentTierLevel = PLAN_TYPE_LEVEL[current.planSlug.toLowerCase()] ?? 0;
  const targetTierLevel = PLAN_TYPE_LEVEL[target.planSlug.toLowerCase()] ?? 0;

  // 获取付费周期优先级
  const currentBillingPriority = getBillingCyclePriority(
    current.subscriptionType,
    current.billingInterval,
    current.durationMonths,
  );
  const targetBillingPriority = getBillingCyclePriority(
    target.subscriptionType,
    target.billingInterval,
    target.durationMonths,
  );

  const isCurrentPlan = currentLevel === targetLevel;

  // 计算是否可以升级
  let canUpgrade = false;

  if (targetTierLevel > currentTierLevel) {
    // 跨方案类型升级（更高等级的方案）
    if (currentBillingPriority <= 2) {
      // 当前是月付（一次性1月或连续包月），任何付费周期都可升级
      canUpgrade = true;
    } else if (currentBillingPriority <= 4) {
      // 当前是季付或半年付（一次性3/6月）
      // 目标付费周期优先级必须 >= 当前优先级
      canUpgrade = targetBillingPriority >= currentBillingPriority;
    } else {
      // 当前是年付（一次性12月优先级5，连续包年优先级6）
      // 目标必须是一次性12月（5）或连续包年（6）
      canUpgrade = targetBillingPriority >= 5;
    }
  } else if (targetTierLevel === currentTierLevel) {
    // 同方案类型升级：目标付费周期优先级必须 > 当前优先级
    canUpgrade = targetBillingPriority > currentBillingPriority;
  } else {
    // 更低等级的方案，不能升级
    canUpgrade = false;
  }

  const isSameLevelOrLower = !canUpgrade && !isCurrentPlan;

  return {
    canUpgrade,
    isCurrentPlan,
    isSameLevelOrLower,
  };
}
