"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveImageSinglePrice = void 0;
const DEFAULT_REFERENCE_MP = (1024 * 1024) / 1000000;
const resolveImageSinglePrice = (pricing) => {
    if (!pricing)
        return {};
    // Priority 1: Use approximate price if explicitly provided
    if (typeof pricing.approximatePricePerImage === 'number') {
        return { approximatePrice: pricing.approximatePricePerImage };
    }
    // Priority 2: Calculate exact price from pricing units
    const imageGenerationUnit = pricing.units.find((unit) => unit.name === 'imageGeneration');
    if (!imageGenerationUnit)
        return {};
    if (imageGenerationUnit.strategy === 'fixed') {
        if (imageGenerationUnit.unit === 'image') {
            return { price: imageGenerationUnit.rate };
        }
        if (imageGenerationUnit.unit === 'megapixel') {
            return { price: imageGenerationUnit.rate * DEFAULT_REFERENCE_MP };
        }
    }
    // Lookup/tiered pricing typically requires explicit configuration; treat as unavailable here.
    return {};
};
exports.resolveImageSinglePrice = resolveImageSinglePrice;
//# sourceMappingURL=resolveImageSinglePrice.js.map