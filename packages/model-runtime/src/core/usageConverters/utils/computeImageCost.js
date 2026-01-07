"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeImageCost = void 0;
const currency_1 = require("@lobechat/const/currency");
const debug_1 = __importDefault(require("debug"));
const log = (0, debug_1.default)('lobe-cost:computeImagePricing');
/**
 * Compute the cost for image generation based on pricing configuration
 * @param pricing - The pricing configuration for the model
 * @param params - Image generation parameters (quality, size, etc.)
 * @param imageNum - Number of images to generate
 * @returns ImageCostResult with total cost in USD and credits, or undefined if pricing not found
 */
const computeImageCost = (pricing, params, imageNum) => {
    // Find imageGeneration pricing unit
    const imageGenUnit = pricing.units.find((unit) => unit.name === 'imageGeneration');
    if (!imageGenUnit) {
        log('No imageGeneration unit found in pricing configuration');
        return undefined;
    }
    let pricePerImageInUSD = 0;
    let lookupKey;
    switch (imageGenUnit.strategy) {
        case 'fixed': {
            const fixedUnit = imageGenUnit;
            if (fixedUnit.unit !== 'image') {
                log(`Unsupported unit type for fixed pricing: ${fixedUnit.unit}`);
                return undefined;
            }
            pricePerImageInUSD = fixedUnit.rate;
            log(`Fixed pricing: $${pricePerImageInUSD} per image`);
            break;
        }
        case 'lookup': {
            const lookupUnit = imageGenUnit;
            // Build lookup key from params
            const lookupParams = [];
            // Check required pricing params
            if (lookupUnit.lookup?.pricingParams) {
                for (const paramName of lookupUnit.lookup.pricingParams) {
                    const paramValue = params[paramName];
                    if (paramValue === undefined || paramValue === null) {
                        log(`Missing required lookup param: ${paramName}`);
                        return undefined;
                    }
                    lookupParams.push(String(paramValue));
                }
                lookupKey = lookupParams.join('_');
            }
            else {
                log('No pricing params defined for lookup strategy');
                return undefined;
            }
            // Find price for the lookup key
            const lookupPrice = lookupUnit.lookup?.prices?.[lookupKey];
            if (typeof lookupPrice !== 'number') {
                log(`No price found for lookup key: ${lookupKey}`);
                return undefined;
            }
            pricePerImageInUSD = lookupPrice;
            log(`Lookup pricing for key "${lookupKey}": $${pricePerImageInUSD} per image`);
            break;
        }
        case 'tiered': {
            // TODO: Implement tiered pricing when needed
            log('Tiered pricing strategy not yet implemented for image generation');
            return undefined;
        }
        default: {
            // @ts-expect-error - PricingUnit strategy may have unsupported values
            log(`Unsupported pricing strategy: ${imageGenUnit.strategy}`);
            return undefined;
        }
    }
    // Calculate total cost in USD first, then convert to credits
    const totalCost = pricePerImageInUSD * imageNum;
    const totalCredits = Math.ceil(totalCost * currency_1.CREDITS_PER_DOLLAR);
    log(`Image cost calculation: ${imageNum} images × $${pricePerImageInUSD} = $${totalCost} (${totalCredits} credits)`);
    return {
        breakdown: {
            imageCount: imageNum,
            lookupKey,
            pricePerImage: pricePerImageInUSD,
        },
        totalCost,
        totalCredits,
    };
};
exports.computeImageCost = computeImageCost;
//# sourceMappingURL=computeImageCost.js.map