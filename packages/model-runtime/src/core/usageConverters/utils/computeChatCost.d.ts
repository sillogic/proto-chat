import { ModelTokensUsage } from '@lobechat/types';
import { Pricing, PricingUnit } from 'model-bank';
export interface PricingUnitBreakdown {
    cost: number;
    credits: number;
    currency: string | 'USD' | 'CNY';
    /**
     * For lookup strategies we expose the resolved key.
     */
    lookupKey?: string;
    quantity: number;
    /**
     * Extra details for tiered strategies to help consumers render ladders.
     */
    segments?: Array<{
        credits: number;
        quantity: number;
        rate: number;
    }>;
    unit: PricingUnit;
}
export interface PricingComputationIssue {
    reason: string;
    unit: PricingUnit;
}
export interface ComputeChatCostOptions {
    /**
     * Input parameters used by lookup strategies (e.g. ttl, thinkingMode).
     */
    lookupParams?: Record<string, string | number | boolean>;
    /**
     * Exchange rate for CNY to USD conversion. Defaults to USD_TO_CNY constant.
     * Useful for testing with fixed exchange rates.
     */
    usdToCnyRate?: number;
}
export interface PricingComputationResult {
    breakdown: PricingUnitBreakdown[];
    issues: PricingComputationIssue[];
    totalCost: number;
    totalCredits: number;
}
/**
 * 1. Keep raw credits for each item (may be decimal)
 * 2. Round up uniformly at the totals stage to prevent cost undercounting
 */
export declare const computeChatCost: (pricing: Pricing | undefined, usage: ModelTokensUsage, options?: ComputeChatCostOptions) => PricingComputationResult | undefined;
//# sourceMappingURL=computeChatCost.d.ts.map