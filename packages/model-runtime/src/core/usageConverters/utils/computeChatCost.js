"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeChatCost = void 0;
/* eslint-disable sort-keys-fix/sort-keys-fix */
const currency_1 = require("@lobechat/const/currency");
const debug_1 = __importDefault(require("debug"));
const log = (0, debug_1.default)('lobe-cost:computeChatPricing');
const UNIT_QUANTITY_RESOLVERS = {
    textInput: (usage) => {
        if (usage.inputCacheMissTokens !== undefined) {
            return usage.inputCacheMissTokens;
        }
        if (typeof usage.inputCachedTokens === 'number' && typeof usage.totalInputTokens === 'number') {
            throw new Error('Missing inputCacheMissTokens! You can set it by inputCacheMissTokens = totalInputTokens - inputCachedTokens');
        }
        return usage.inputTextTokens ?? usage.totalInputTokens;
    },
    textInput_cacheRead: (usage) => usage.inputCachedTokens,
    textInput_cacheWrite: (usage) => usage.inputWriteCacheTokens,
    // reasoning tokens cost within output tokens
    textOutput: (usage) => {
        const { outputTextTokens, totalOutputTokens, outputReasoningTokens = 0 } = usage;
        const reasoningTokens = outputReasoningTokens;
        if (typeof outputTextTokens === 'number') {
            return outputTextTokens + reasoningTokens;
        }
        if (typeof totalOutputTokens === 'number') {
            return totalOutputTokens;
        }
        if (typeof usage.outputReasoningTokens === 'number') {
            return usage.outputReasoningTokens;
        }
        return undefined;
    },
    imageInput: (usage) => usage.inputImageTokens,
    imageInput_cacheRead: () => undefined,
    imageOutput: (usage) => usage.outputImageTokens,
    imageGeneration: () => undefined,
    audioInput: (usage) => usage.inputAudioTokens,
    // TODO: Support this when ModelTokensUsage includes this data
    audioInput_cacheRead: () => undefined,
    audioOutput: (usage) => usage.outputAudioTokens,
};
/**
 * Convert currency-specific credits to USD credits and ceil to integer
 * @param credits - Credits in the original currency
 * @param currency - The currency of the credits ('USD' or 'CNY')
 * @param usdToCnyRate - Exchange rate for CNY to USD conversion (defaults to USD_TO_CNY constant)
 * @returns USD-equivalent credits (ceiled to integer)
 */
const toUSDCredits = (credits, currency = 'USD', usdToCnyRate = currency_1.USD_TO_CNY) => {
    const usdCredits = currency === 'CNY' ? credits / usdToCnyRate : credits;
    return Math.ceil(usdCredits);
};
/**
 * Convert credits to USD dollar amount
 * @param credits - USD credits
 * @returns USD dollar amount
 */
const creditsToUSD = (credits) => credits / currency_1.CREDITS_PER_DOLLAR;
/**
 * Returns raw credits, which will be rounded up uniformly at the final aggregation stage.
 */
const computeFixedCredits = (unit, quantity) => quantity * unit.rate;
/**
 * Google provider uses new pricing for entire input and output when exceeding threshold, not tiered calculation
 * TODO: Some providers do use tiered calculation, such as Zhipu
 */
const computeTieredCredits = (unit, quantity) => {
    if (quantity <= 0)
        return { credits: 0, segments: [] };
    const segments = [];
    const tiers = unit.tiers ?? [];
    if (tiers.length === 0)
        return { credits: 0, segments };
    // Google and other providers charge the entire quantity at the new rate when exceeding threshold
    const matchedTier = tiers.find((tier) => {
        const limit = tier.upTo === 'infinity' ? Number.POSITIVE_INFINITY : tier.upTo;
        return quantity <= limit;
    }) ?? tiers.at(-1);
    if (!matchedTier)
        return { credits: 0, segments };
    const credits = quantity * matchedTier.rate;
    segments.push({ credits, quantity, rate: matchedTier.rate });
    return { credits, segments };
};
const resolveLookupKey = (unit, options) => {
    if (!unit.lookup?.pricingParams?.length)
        return { key: undefined };
    const missingParams = [];
    const params = unit.lookup.pricingParams.map((param) => {
        const source = options?.lookupParams?.[param];
        if (source === undefined || source === null) {
            missingParams.push(param);
            return 'undefined';
        }
        if (typeof source === 'boolean')
            return String(source);
        return String(source);
    });
    if (missingParams.length > 0)
        return { key: undefined, missingParams };
    return { key: params.join('_') };
};
const computeLookupCredits = (unit, quantity, options) => {
    const { key, missingParams } = resolveLookupKey(unit, options);
    if (missingParams && missingParams.length > 0) {
        return {
            credits: 0,
            issues: {
                reason: `Missing lookup params: ${missingParams.join(', ')}`,
                unit,
            },
        };
    }
    if (!key) {
        return {
            credits: 0,
            issues: {
                reason: 'Lookup key could not be resolved',
                unit,
            },
        };
    }
    const lookupRate = unit.lookup.prices?.[key];
    if (typeof lookupRate !== 'number') {
        return {
            credits: 0,
            issues: {
                reason: `Lookup price not found for key "${key}"`,
                unit,
            },
            key,
        };
    }
    return {
        credits: quantity * lookupRate,
        key,
    };
};
const resolveQuantity = (unit, usage) => {
    const resolver = UNIT_QUANTITY_RESOLVERS[unit.name];
    const quantity = resolver?.(usage);
    return typeof quantity === 'number' ? quantity : undefined;
};
/**
 * 1. Keep raw credits for each item (may be decimal)
 * 2. Round up uniformly at the totals stage to prevent cost undercounting
 */
const computeChatCost = (pricing, usage, options) => {
    if (!pricing)
        return undefined;
    const breakdown = [];
    const issues = [];
    const currency = pricing.currency || 'USD';
    const usdToCnyRate = options?.usdToCnyRate ?? currency_1.USD_TO_CNY;
    for (const unit of pricing.units) {
        const quantity = resolveQuantity(unit, usage);
        if (quantity === undefined)
            continue;
        if (unit.strategy === 'fixed') {
            if (unit.unit !== 'millionTokens')
                throw new Error(`Unsupported chat pricing unit: ${unit.unit}`);
            const fixedUnit = unit;
            const rawCredits = computeFixedCredits(fixedUnit, quantity);
            const usdCredits = toUSDCredits(rawCredits, currency, usdToCnyRate);
            breakdown.push({
                cost: creditsToUSD(usdCredits),
                credits: usdCredits,
                quantity,
                currency,
                unit,
            });
            continue;
        }
        if (unit.strategy === 'tiered') {
            const tieredUnit = unit;
            const { credits: rawCredits, segments } = computeTieredCredits(tieredUnit, quantity);
            const usdCredits = toUSDCredits(rawCredits, currency, usdToCnyRate);
            breakdown.push({
                cost: creditsToUSD(usdCredits),
                credits: usdCredits,
                quantity,
                currency,
                segments,
                unit,
            });
            continue;
        }
        if (unit.strategy === 'lookup') {
            const lookupUnit = unit;
            const { credits: rawCredits, key, issues: lookupIssue, } = computeLookupCredits(lookupUnit, quantity, options);
            if (lookupIssue)
                issues.push(lookupIssue);
            const usdCredits = toUSDCredits(rawCredits, currency, usdToCnyRate);
            breakdown.push({
                cost: creditsToUSD(usdCredits),
                credits: usdCredits,
                lookupKey: key,
                quantity,
                currency,
                unit,
            });
            continue;
        }
        issues.push({ reason: 'Unsupported pricing strategy', unit });
    }
    // Sum up USD credits from all breakdown items
    const rawTotalCredits = breakdown.reduce((sum, item) => sum + item.credits, 0);
    const totalCredits = Math.ceil(rawTotalCredits);
    // !: totalCredits has been uniformly rounded up to integer USD credits, divided by CREDITS_PER_DOLLAR naturally retains only 6 decimal places, no additional processing needed
    const totalCost = creditsToUSD(totalCredits);
    log(`computeChatPricing breakdown: ${JSON.stringify(breakdown, null, 2)}`);
    return {
        breakdown,
        issues,
        totalCost,
        totalCredits,
    };
};
exports.computeChatCost = computeChatCost;
//# sourceMappingURL=computeChatCost.js.map