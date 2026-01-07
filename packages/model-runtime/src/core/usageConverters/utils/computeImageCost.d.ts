import { Pricing } from 'model-bank';
export interface ImageGenerationParams {
    [key: string]: any;
    quality?: 'standard' | 'hd';
    size?: string;
}
export interface ImageCostResult {
    breakdown?: {
        imageCount: number;
        lookupKey?: string;
        pricePerImage: number;
    };
    totalCost: number;
    totalCredits: number;
}
/**
 * Compute the cost for image generation based on pricing configuration
 * @param pricing - The pricing configuration for the model
 * @param params - Image generation parameters (quality, size, etc.)
 * @param imageNum - Number of images to generate
 * @returns ImageCostResult with total cost in USD and credits, or undefined if pricing not found
 */
export declare const computeImageCost: (pricing: Pricing, params: ImageGenerationParams, imageNum: number) => ImageCostResult | undefined;
//# sourceMappingURL=computeImageCost.d.ts.map