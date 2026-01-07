"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGoogleImage = createGoogleImage;
const utils_1 = require("@lobechat/utils");
const google_ai_1 = require("../../core/usageConverters/google-ai");
const createError_1 = require("../../utils/createError");
const getModelPricing_1 = require("../../utils/getModelPricing");
const googleErrorParser_1 = require("../../utils/googleErrorParser");
const uriParser_1 = require("../../utils/uriParser");
// Maximum number of images allowed for processing
const MAX_IMAGE_COUNT = 10;
/**
 * Process a single image URL and convert it to Google AI Part format
 */
async function processImageForParts(imageUrl) {
    const { mimeType, base64, type } = (0, uriParser_1.parseDataUri)(imageUrl);
    if (type === 'base64') {
        if (!base64) {
            throw new TypeError("Image URL doesn't contain base64 data");
        }
        return {
            inlineData: {
                data: base64,
                mimeType: mimeType || 'image/png',
            },
        };
    }
    else if (type === 'url') {
        const { base64: urlBase64, mimeType: urlMimeType } = await (0, utils_1.imageUrlToBase64)(imageUrl);
        return {
            inlineData: {
                data: urlBase64,
                mimeType: urlMimeType,
            },
        };
    }
    else {
        throw new TypeError(`currently we don't support image url: ${imageUrl}`);
    }
}
/**
 * Extract image data from generateContent response
 */
function extractImageFromResponse(response) {
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === 'NO_IMAGE') {
        throw new Error('No image generated');
    }
    if (!candidate?.content?.parts) {
        // Handle cases where Google returns 200 but omits image parts (often moderation)
        throw new Error('No image generated');
    }
    for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
            const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            return { imageUrl };
        }
    }
    // Fallback when no inlineData is present (commonly moderation or policy blocks)
    throw new Error('No image data found in response');
}
/**
 * Generate images using traditional Imagen models with generateImages API
 */
async function generateByImageModel(client, payload) {
    const { model, params } = payload;
    const response = await client.models.generateImages({
        config: {
            aspectRatio: params.aspectRatio,
            numberOfImages: 1,
        },
        model,
        prompt: params.prompt,
    });
    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
        throw new Error('No image generated');
    }
    // 1. official doc use png as example
    // 2. no responseType param support like openai now.
    // I think we can just hard code png now
    const imageUrl = `data:image/png;base64,${imageBytes}`;
    return { imageUrl };
}
/**
 * Generate images using Gemini Chat Models with generateContent
 */
async function generateImageByChatModel(client, payload, provider) {
    const { model, params } = payload;
    const actualModel = model.replace(':image', '');
    // Check for conflicting image parameters
    if (params.imageUrl && params.imageUrls && params.imageUrls.length > 0) {
        throw new TypeError('Cannot provide both imageUrl and imageUrls parameters simultaneously');
    }
    // Build content parts
    const parts = [{ text: params.prompt }];
    // Add image for editing if provided
    if (params.imageUrl && params.imageUrl !== null) {
        const imagePart = await processImageForParts(params.imageUrl);
        parts.push(imagePart);
    }
    // Add multiple images for editing if provided
    if (params.imageUrls && Array.isArray(params.imageUrls) && params.imageUrls.length > 0) {
        if (params.imageUrls.length > MAX_IMAGE_COUNT) {
            throw new TypeError(`Too many images provided. Maximum ${MAX_IMAGE_COUNT} images allowed`);
        }
        const imageParts = await Promise.all(params.imageUrls.map((imageUrl) => processImageForParts(imageUrl)));
        parts.push(...imageParts);
    }
    const contents = [
        {
            parts,
            role: 'user',
        },
    ];
    const config = {
        responseModalities: ['Image'],
        ...(params.aspectRatio
            ? {
                imageConfig: {
                    aspectRatio: params.aspectRatio,
                    imageSize: params.resolution,
                },
            }
            : {}),
    };
    const response = await client.models.generateContent({
        config,
        contents,
        model: actualModel,
    });
    const imageResponse = extractImageFromResponse(response);
    if (response.usageMetadata) {
        const pricing = await (0, getModelPricing_1.getModelPricing)(model, provider);
        imageResponse.modelUsage = (0, google_ai_1.convertGoogleAIUsage)(response.usageMetadata, pricing);
    }
    return imageResponse;
}
/**
 * Create image using Google AI models
 */
async function createGoogleImage(client, provider, payload) {
    try {
        const { model } = payload;
        // Handle Gemini 2.5 Flash Image models that use generateContent
        if (model.endsWith(':image')) {
            return await generateImageByChatModel(client, payload, provider);
        }
        // Handle traditional Imagen models that use generateImages
        return await generateByImageModel(client, payload);
    }
    catch (error) {
        const err = error;
        if (err?.errorType) {
            throw err;
        }
        const { errorType, error: parsedError } = (0, googleErrorParser_1.parseGoogleErrorMessage)(err.message);
        throw createError_1.AgentRuntimeError.createImage({
            error: parsedError,
            errorType,
            provider,
        });
    }
}
//# sourceMappingURL=createImage.js.map