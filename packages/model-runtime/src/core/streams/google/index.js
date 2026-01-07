"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleGenerativeAIStream = exports.LOBE_ERROR_KEY = void 0;
const uuid_1 = require("../../../utils/uuid");
const google_ai_1 = require("../../usageConverters/google-ai");
const protocol_1 = require("../protocol");
const const_1 = require("./const");
exports.LOBE_ERROR_KEY = '__lobe_error';
const getBlockReasonMessage = (blockReason) => {
    const blockReasonMessages = const_1.GOOGLE_AI_BLOCK_REASON;
    return (blockReasonMessages[blockReason] ||
        blockReasonMessages.default.replace('{{blockReason}}', blockReason));
};
const transformGoogleGenerativeAIStream = (chunk, context, payload) => {
    // Handle injected internal error marker to pass through detailed error info
    if (chunk?.[exports.LOBE_ERROR_KEY]) {
        return {
            data: chunk[exports.LOBE_ERROR_KEY],
            id: context?.id || 'error',
            type: 'error',
        };
    }
    // Handle promptFeedback with blockReason (e.g., PROHIBITED_CONTENT)
    if ('promptFeedback' in chunk && chunk.promptFeedback?.blockReason) {
        const blockReason = chunk.promptFeedback.blockReason;
        const humanFriendlyMessage = getBlockReasonMessage(blockReason);
        return {
            data: {
                body: {
                    context: {
                        promptFeedback: chunk.promptFeedback,
                    },
                    message: humanFriendlyMessage,
                    provider: 'google',
                },
                type: 'ProviderBizError',
            },
            id: context?.id || 'error',
            type: 'error',
        };
    }
    // maybe need another structure to add support for multiple choices
    const candidate = chunk.candidates?.[0];
    const { usageMetadata } = chunk;
    const usageChunks = [];
    if (candidate?.finishReason && usageMetadata) {
        usageChunks.push({ data: candidate.finishReason, id: context?.id, type: 'stop' });
        const convertedUsage = (0, google_ai_1.convertGoogleAIUsage)(usageMetadata, payload?.pricing);
        if (convertedUsage) {
            usageChunks.push({ data: convertedUsage, id: context?.id, type: 'usage' });
        }
    }
    // Parse function calls from candidate.content.parts
    const functionCalls = candidate?.content?.parts
        ?.filter((part) => part.functionCall)
        .map((part) => ({
        ...part.functionCall,
        thoughtSignature: part.thoughtSignature,
    })) || [];
    if (functionCalls.length > 0) {
        return [
            {
                data: functionCalls.map((value, index) => ({
                    function: {
                        arguments: JSON.stringify(value.args),
                        name: value.name,
                    },
                    id: (0, protocol_1.generateToolCallId)(index, value.name),
                    index: index,
                    thoughtSignature: value.thoughtSignature,
                    type: 'function',
                })),
                id: context.id,
                type: 'tool_calls',
            },
            ...usageChunks,
        ];
    }
    // Parse text from candidate.content.parts
    // Filter out thought content (thought: true) only, keep thoughtSignature as it's just metadata
    const text = candidate?.content?.parts
        ?.filter((part) => part.text && !part.thought)
        .map((part) => part.text)
        .join('') || '';
    if (candidate) {
        // Check if this response contains reasoning or multimodal content
        const parts = candidate.content?.parts || [];
        const hasReasoningParts = parts.some((p) => p.thought === true);
        const hasImageParts = parts.some((p) => p.inlineData);
        const hasThoughtSignature = parts.some((p) => p.thoughtSignature);
        const hasThoughtsInMetadata = usageMetadata?.thoughtsTokenCount > 0;
        // Check model version to determine if new format should be used
        const modelVersion = chunk.modelVersion || '';
        const isGemini25Plus = modelVersion.includes('gemini-2.5') || modelVersion.includes('gemini-3');
        const isGemini3Model = modelVersion.includes('gemini-3') || modelVersion.includes('image-preview');
        // Check if this is the old single-image scenario (single image part with finishReason)
        // This should use the legacy base64_image event format (only for gemini-2.0 and earlier)
        const isSingleImageWithFinish = parts.length === 1 &&
            hasImageParts &&
            !hasReasoningParts &&
            candidate.finishReason &&
            !isGemini25Plus;
        // Check if this has grounding metadata (should use legacy text + grounding events)
        const hasGroundingMetadata = !!candidate.groundingMetadata?.groundingChunks;
        // Use content_part/reasoning_part events when:
        // 1. There are reasoning parts in current chunk (thought: true)
        // 2. There are multiple parts with images (multimodal content)
        // 3. There are thoughtSignature in parts (reasoning metadata attached to content)
        // 4. There is thoughtsTokenCount in metadata (indicates response contains reasoning)
        // 5. This is Gemini 3 model with image generation (always use new format for consistency)
        // BUT NOT for:
        // - The legacy single-image scenario
        // - Grounding metadata scenario (uses legacy text + grounding events)
        const shouldUseMultimodalProcessing = (hasReasoningParts ||
            (hasImageParts && parts.length > 1) ||
            hasThoughtSignature ||
            hasThoughtsInMetadata ||
            isGemini3Model) &&
            !isSingleImageWithFinish &&
            !hasGroundingMetadata;
        // Process multimodal parts (text and images in reasoning or content)
        if (shouldUseMultimodalProcessing &&
            Array.isArray(candidate.content?.parts) &&
            candidate.content.parts.length > 0) {
            const results = [];
            for (const part of candidate.content.parts) {
                // 1. Reasoning text part
                if (part && part.text && part.thought === true) {
                    results.push({
                        data: {
                            content: part.text,
                            inReasoning: true,
                            partType: 'text',
                            thoughtSignature: part.thoughtSignature,
                        },
                        id: context.id,
                        type: 'reasoning_part',
                    });
                }
                // 2. Reasoning image part
                else if (part && part.inlineData && part.thought === true) {
                    results.push({
                        data: {
                            content: part.inlineData.data,
                            inReasoning: true,
                            mimeType: part.inlineData.mimeType,
                            partType: 'image',
                            thoughtSignature: part.thoughtSignature,
                        },
                        id: context.id,
                        type: 'reasoning_part',
                    });
                }
                // 3. Content text part
                else if (part && part.text && !part.thought) {
                    results.push({
                        data: {
                            content: part.text,
                            partType: 'text',
                            thoughtSignature: part.thoughtSignature,
                        },
                        id: context.id,
                        type: 'content_part',
                    });
                }
                // 4. Content image part
                else if (part && part.inlineData && !part.thought) {
                    results.push({
                        data: {
                            content: part.inlineData.data,
                            mimeType: part.inlineData.mimeType,
                            partType: 'image',
                            thoughtSignature: part.thoughtSignature,
                        },
                        id: context.id,
                        type: 'content_part',
                    });
                }
            }
            // If we found multimodal parts, return them with usage chunks
            if (results.length > 0) {
                if (candidate.finishReason && usageMetadata) {
                    results.push(...usageChunks);
                }
                return results;
            }
        }
        // return the grounding
        const { groundingChunks, webSearchQueries } = candidate.groundingMetadata ?? {};
        if (groundingChunks) {
            return [
                { data: text, id: context.id, type: 'text' },
                {
                    data: {
                        citations: groundingChunks?.map((chunk) => ({
                            // google 返回的 uri 是经过 google 自己处理过的 url，因此无法展现真实的 favicon
                            // 需要使用 title 作为替换
                            favicon: chunk.web?.title,
                            title: chunk.web?.title,
                            url: chunk.web?.uri,
                        })),
                        searchQueries: webSearchQueries,
                    },
                    id: context.id,
                    type: 'grounding',
                },
                ...usageChunks,
            ];
        }
        // Check for image data before handling finishReason
        if (Array.isArray(candidate.content?.parts) && candidate.content.parts.length > 0) {
            // Filter out reasoning content and get first non-reasoning part
            const part = candidate.content.parts.find((p) => !p.thought);
            if (part && part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
                const imageChunk = {
                    data: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    id: context.id,
                    type: 'base64_image',
                };
                // If also has finishReason, combine image with finish chunks
                if (candidate.finishReason) {
                    const chunks = [imageChunk];
                    if (chunk.usageMetadata) {
                        // usageChunks already includes the 'stop' chunk as its first entry when usage exists,
                        // so append usageChunks to avoid sending a duplicate 'stop'.
                        chunks.push(...usageChunks);
                    }
                    else {
                        // No usage metadata, we need to send the stop chunk explicitly.
                        chunks.push({ data: candidate.finishReason, id: context?.id, type: 'stop' });
                    }
                    return chunks;
                }
                return imageChunk;
            }
        }
        if (candidate.finishReason) {
            if (chunk.usageMetadata) {
                return [
                    !!text ? { data: text, id: context?.id, type: 'text' } : undefined,
                    ...usageChunks,
                ].filter(Boolean);
            }
            // 当有 finishReason 但没有 text 内容时,发送一个空的 text 块以停止加载动画
            return [
                { data: '', id: context?.id, type: 'text' },
                { data: candidate.finishReason, id: context?.id, type: 'stop' },
            ];
        }
        if (!!text?.trim())
            return { data: text, id: context?.id, type: 'text' };
    }
    return {
        data: text || '',
        id: context?.id,
        type: 'text',
    };
};
const GoogleGenerativeAIStream = (rawStream, { callbacks, inputStartAt, enableStreaming = true, payload } = {}) => {
    const streamStack = { id: 'chat_' + (0, uuid_1.nanoid)() };
    const transformWithPayload = (chunk, ctx) => transformGoogleGenerativeAIStream(chunk, ctx, payload);
    return rawStream
        .pipeThrough((0, protocol_1.createTokenSpeedCalculator)(transformWithPayload, {
        enableStreaming: enableStreaming,
        inputStartAt,
        streamStack,
    }))
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)((c) => c, streamStack, { requireTerminalEvent: true }))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(callbacks));
};
exports.GoogleGenerativeAIStream = GoogleGenerativeAIStream;
//# sourceMappingURL=index.js.map