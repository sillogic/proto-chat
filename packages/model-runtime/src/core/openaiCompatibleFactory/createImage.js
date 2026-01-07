"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpenAICompatibleImage = createOpenAICompatibleImage;
const utils_1 = require("@lobechat/utils");
const object_1 = require("@lobechat/utils/object");
const debug_1 = __importDefault(require("debug"));
const getModelPricing_1 = require("../../utils/getModelPricing");
const uriParser_1 = require("../../utils/uriParser");
const openai_1 = require("../contextBuilders/openai");
const openai_2 = require("../usageConverters/openai");
const log = (0, debug_1.default)('lobe-image:openai-compatible');
/**
 * Generate images using traditional OpenAI images API (DALL-E, etc.)
 */
async function generateByImageMode(client, payload, provider) {
    const { model, params } = payload;
    log('Creating image with model: %s and params: %O', model, params);
    // Map parameter names, mapping imageUrls to image
    const paramsMap = new Map([
        ['imageUrls', 'image'],
        ['imageUrl', 'image'],
    ]);
    const userInput = Object.fromEntries(Object.entries(params).map(([key, value]) => [
        paramsMap.get(key) ?? key,
        value,
    ]));
    // unify image input to array
    if (typeof userInput.image === 'string' && userInput.image.trim() !== '') {
        userInput.image = [userInput.image];
    }
    // https://platform.openai.com/docs/api-reference/images/createEdit
    const isImageEdit = Array.isArray(userInput.image) && userInput.image.length > 0;
    log('isImageEdit: %O, userInput.image: %O', isImageEdit, userInput.image);
    // If there are imageUrls parameters, convert them to File objects
    if (isImageEdit) {
        try {
            // Convert all image URLs to File objects
            const imageFiles = await Promise.all(userInput.image.map((url) => (0, openai_1.convertImageUrlToFile)(url)));
            // According to official docs, if there are multiple images, pass an array; if only one, pass a single File
            userInput.image = imageFiles.length === 1 ? imageFiles[0] : imageFiles;
        }
        catch (error) {
            throw new Error(`Failed to convert image URLs to File objects: ${error}`);
        }
    }
    else {
        delete userInput.image;
    }
    if (userInput.size === 'auto') {
        delete userInput.size;
    }
    const defaultInput = {
        n: 1,
        ...(model.includes('dall-e') ? { response_format: 'b64_json' } : {}),
        ...(isImageEdit && model === 'gpt-image-1' ? { input_fidelity: 'high' } : {}),
    };
    const options = (0, object_1.cleanObject)({
        model,
        ...defaultInput,
        ...userInput,
    });
    log('options: %O', options);
    // Determine if it's an image editing operation
    const img = isImageEdit
        ? await client.images.edit(options)
        : await client.images.generate(options);
    // Check the integrity of response data
    if (!img || !img.data || !Array.isArray(img.data) || img.data.length === 0) {
        throw new Error('Invalid image response: missing or empty data array');
    }
    const imageData = img.data[0];
    if (!imageData) {
        throw new Error('Invalid image response: first data item is null or undefined');
    }
    let imageUrl;
    // Handle base64 format response
    if (imageData.b64_json) {
        // Determine the image's MIME type, default to PNG
        const mimeType = 'image/png'; // OpenAI image generation defaults to PNG format
        // Convert base64 string to complete data URL
        imageUrl = `data:${mimeType};base64,${imageData.b64_json}`;
        log('Successfully converted base64 to data URL, length: %d', imageUrl.length);
    }
    // Handle URL format response
    else if (imageData.url) {
        imageUrl = imageData.url;
        log('Using direct image URL: %s', imageUrl);
    }
    // If neither format exists, throw error
    else {
        throw new Error('Invalid image response: missing both b64_json and url fields');
    }
    return {
        imageUrl,
        ...(img.usage
            ? {
                modelUsage: (0, openai_2.convertOpenAIImageUsage)(img.usage, await (0, getModelPricing_1.getModelPricing)(model, provider)),
            }
            : {}),
    };
}
/**
 * Process image URL for chat model input
 */
async function processImageUrlForChat(imageUrl) {
    const { type, base64, mimeType } = (0, uriParser_1.parseDataUri)(imageUrl);
    if (type === 'base64') {
        if (!base64) {
            throw new TypeError("Image URL doesn't contain base64 data");
        }
        return `data:${mimeType || 'image/png'};base64,${base64}`;
    }
    else if (type === 'url') {
        // For URL type, convert to base64 first
        const { base64: urlBase64, mimeType: urlMimeType } = await (0, utils_1.imageUrlToBase64)(imageUrl);
        return `data:${urlMimeType};base64,${urlBase64}`;
    }
    else {
        throw new TypeError(`Currently we don't support image url: ${imageUrl}`);
    }
}
/**
 * Generate images using chat completion API (OpenRouter Gemini, etc.)
 */
async function generateByChatModel(client, payload) {
    const { model, params } = payload;
    const actualModel = model.replace(':image', ''); // Remove :image suffix
    log('Creating image via chat API with model: %s and params: %O', actualModel, params);
    // Build message content array
    const content = [
        {
            text: params.prompt,
            type: 'text',
        },
    ];
    // Add image for editing mode if provided
    if (params.imageUrl && params.imageUrl !== null) {
        log('Processing image URL for editing mode: %s', params.imageUrl);
        try {
            const processedImageUrl = await processImageUrlForChat(params.imageUrl);
            content.push({
                image_url: {
                    url: processedImageUrl,
                },
                type: 'image_url',
            });
            log('Successfully processed image URL for chat input');
        }
        catch (error) {
            throw new Error(`Failed to process image URL: ${error}`);
        }
    }
    // Call chat completion API
    const response = await client.chat.completions.create({
        messages: [
            {
                content,
                role: 'user',
            },
        ],
        model: actualModel,
        stream: false,
    });
    log('Chat API response: %O', response);
    // Extract image from response
    const message = response.choices[0]?.message;
    if (!message) {
        throw new Error('No message in chat completion response');
    }
    // Check if response has images in the expected format
    if (message.images && Array.isArray(message.images)) {
        const { images } = message;
        if (images.length > 0) {
            const image = images[0];
            if (image.image_url?.url) {
                log('Successfully extracted image from chat response');
                return { imageUrl: image.image_url.url };
            }
        }
    }
    // If no images found, throw error
    throw new Error('No image generated in chat completion response');
}
/**
 * Create image using OpenAI Compatible API
 */
async function createOpenAICompatibleImage(client, payload, provider) {
    const { model } = payload;
    // Check if it's a chat model for image generation (via :image suffix)
    if (model.endsWith(':image')) {
        return await generateByChatModel(client, payload);
    }
    // Default to traditional images API
    return await generateByImageMode(client, payload, provider);
}
//# sourceMappingURL=createImage.js.map