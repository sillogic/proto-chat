import type { ChatModelCard } from '@lobechat/types';
import { AiModelType } from 'model-bank';
export declare const IMAGE_GENERATION_MODEL_WHITELIST: readonly ["gemini-2.5-flash-image-preview", "gemini-2.5-flash-image-preview:free", "gemini-3-pro-image-preview", "gemini-3-pro-image-preview:free"];
/**
 * Process model list: ensure type field exists and generate image generation models for whitelisted models
 * @param models Original model list
 * @param getModelTypeProperty Optional callback function to get model type property
 * @returns Processed model list (including image generation models)
 */
export declare function postProcessModelList(models: ChatModelCard[], getModelTypeProperty?: (modelId: string) => Promise<AiModelType>): Promise<ChatModelCard[]>;
//# sourceMappingURL=postProcessModelList.d.ts.map