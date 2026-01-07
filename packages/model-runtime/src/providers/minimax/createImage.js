"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMiniMaxImage = createMiniMaxImage;
const debug_1 = __importDefault(require("debug"));
const createError_1 = require("../../utils/createError");
const log = (0, debug_1.default)('lobe-image:minimax');
/**
 * Create image using MiniMax API
 */
async function createMiniMaxImage(payload, options) {
    const { apiKey, baseURL, provider } = options;
    const { model, params } = payload;
    try {
        const endpoint = `${baseURL}/image_generation`;
        const response = await fetch(endpoint, {
            body: JSON.stringify({
                aspect_ratio: params.aspectRatio,
                model,
                n: 1,
                prompt: params.prompt,
                //prompt_optimizer: true, // 开启 prompt 自动优化
                ...(typeof params.seed === 'number' ? { seed: params.seed } : {}),
            }),
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            }
            catch {
                // Failed to parse JSON error response
            }
            throw new Error(`MiniMax API error (${response.status}): ${errorData?.base_resp || response.statusText}`);
        }
        const data = await response.json();
        log('Image generation response: %O', data);
        // Check API response status
        if (data.base_resp.status_code !== 0) {
            throw new Error(`MiniMax API error: ${data.base_resp.status_msg}`);
        }
        // Check if we have valid image data
        if (!data.data?.image_urls || data.data.image_urls.length === 0) {
            throw new Error('No images generated in response');
        }
        // Log generation statistics
        const successCount = parseInt(data.metadata.success_count);
        const failedCount = parseInt(data.metadata.failed_count);
        log('Image generation completed: %d successful, %d failed', successCount, failedCount);
        // Return the first generated image URL
        const imageUrl = data.data.image_urls[0];
        if (!imageUrl) {
            throw new Error('No valid image URL in response');
        }
        log('Image generated successfully: %s', imageUrl);
        return { imageUrl };
    }
    catch (error) {
        log('Error in createMiniMaxImage: %O', error);
        throw createError_1.AgentRuntimeError.createImage({
            error: error,
            errorType: 'ProviderBizError',
            provider,
        });
    }
}
//# sourceMappingURL=createImage.js.map