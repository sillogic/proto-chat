import { ModelParamsSchema } from '../standard-parameters';
import { AIImageModelCard } from '../types';
/**
 * FLUX.1 Schnell model parameter configuration
 * Ultra-fast text-to-image mode, generates in 1-4 steps, Apache 2.0 license
 */
export declare const fluxSchnellParamsSchema: ModelParamsSchema;
/**
 * FLUX.1 Dev model parameter configuration
 * High-quality text-to-image mode, supports guidance scale adjustment, non-commercial license
 */
export declare const fluxDevParamsSchema: ModelParamsSchema;
/**
 * FLUX.1 Krea-dev model parameter configuration
 * Enhanced safety text-to-image mode, developed in collaboration with Krea, non-commercial license
 */
export declare const fluxKreaDevParamsSchema: ModelParamsSchema;
/**
 * FLUX.1 Kontext-dev model parameter configuration
 * Image editing mode, supports modifying existing images based on text instructions, non-commercial license
 */
export declare const fluxKontextDevParamsSchema: ModelParamsSchema;
/**
 * SD3.5 model parameter configuration
 * Stable Diffusion 3.5, supports Large and Medium versions, automatically selects by priority
 */
export declare const sd35ParamsSchema: ModelParamsSchema;
/**
 * SD1.5 text-to-image model parameter configuration
 * Stable Diffusion 1.5 text-to-image generation, suitable for 512x512 resolution
 */
export declare const sd15T2iParamsSchema: ModelParamsSchema;
/**
 * SDXL text-to-image model parameter configuration
 * SDXL text-to-image generation, suitable for 1024x1024 resolution
 */
export declare const sdxlT2iParamsSchema: ModelParamsSchema;
/**
 * SDXL image-to-image model parameter configuration
 * SDXL image-to-image generation, supports input image modification
 */
export declare const sdxlI2iParamsSchema: ModelParamsSchema;
/**
 * Custom SD text-to-image model parameter configuration
 * Custom Stable Diffusion text-to-image model with flexible parameter settings
 */
export declare const customSdT2iParamsSchema: ModelParamsSchema;
/**
 * Custom SD image-to-image model parameter configuration
 * Custom Stable Diffusion image-to-image model, supports image editing
 */
export declare const customSdI2iParamsSchema: ModelParamsSchema;
export declare const allModels: AIImageModelCard[];
export default allModels;
//# sourceMappingURL=comfyui.d.ts.map