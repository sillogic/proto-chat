import type { Pricing } from 'model-bank';
/**
 * 1. First try to get pricing from the specified provider
 * 2. If not found, try to get pricing from other providers with the same model name
 *
 * TODO: Add a fallback provider priority list. When no provider is specified,
 * first try official providers, then other providers. Same applies to getFallbackModelProperty
 */
export declare function getModelPricing(model: string, provider?: string): Promise<Pricing | undefined>;
//# sourceMappingURL=getModelPricing.d.ts.map