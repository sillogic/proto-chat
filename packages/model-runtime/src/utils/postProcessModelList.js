"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_GENERATION_MODEL_WHITELIST = void 0;
exports.postProcessModelList = postProcessModelList;
const lodash_es_1 = require("lodash-es");
const model_bank_1 = require("model-bank");
// Whitelist for automatic image model generation
exports.IMAGE_GENERATION_MODEL_WHITELIST = [
    'gemini-2.5-flash-image-preview',
    'gemini-2.5-flash-image-preview:free',
    'gemini-3-pro-image-preview',
    'gemini-3-pro-image-preview:free',
    // More models can be added in the future
];
/**
 * Process model list: ensure type field exists and generate image generation models for whitelisted models
 * @param models Original model list
 * @param getModelTypeProperty Optional callback function to get model type property
 * @returns Processed model list (including image generation models)
 */
async function postProcessModelList(models, getModelTypeProperty) {
    // 1. Ensure all models have type field
    const finalModels = await Promise.all(models.map(async (model) => {
        let modelType = model.type;
        if (!modelType && getModelTypeProperty) {
            modelType = await getModelTypeProperty(model.id);
        }
        return {
            ...model,
            type: modelType || 'chat',
        };
    }));
    // 2. Check whitelist models and generate corresponding image versions
    const imageModels = [];
    for (const whitelistPattern of exports.IMAGE_GENERATION_MODEL_WHITELIST) {
        const matchingModels = finalModels.filter((model) => model.id.endsWith(whitelistPattern));
        for (const model of matchingModels) {
            // Remove unnecessary properties, keep the rest
            const rest = (0, lodash_es_1.omit)(model, [
                'files',
                'functionCall',
                'reasoning',
                'search',
                'imageOutput',
                'video',
                'vision',
                'type',
                'parameters',
            ]);
            imageModels.push({
                ...rest, // Keep other fields (such as displayName, pricing, enabled, contextWindowTokens, etc.)
                id: `${model.id}:image`,
                parameters: model_bank_1.CHAT_MODEL_IMAGE_GENERATION_PARAMS, // Set image parameters
                type: 'image', // Override to image type
            });
        }
    }
    return [...finalModels, ...imageModels];
}
//# sourceMappingURL=postProcessModelList.js.map