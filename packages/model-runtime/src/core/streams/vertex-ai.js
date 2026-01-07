"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexAIStream = void 0;
const uuid_1 = require("../../utils/uuid");
const google_ai_1 = require("../usageConverters/google-ai");
const protocol_1 = require("./protocol");
const transformVertexAIStream = (chunk, context, payload) => {
    // maybe need another structure to add support for multiple choices
    const candidate = chunk.candidates?.[0];
    const usageMetadata = chunk.usageMetadata;
    const usageChunks = [];
    if (candidate?.finishReason && usageMetadata) {
        usageChunks.push({ data: candidate.finishReason, id: context?.id, type: 'stop' }, {
            data: (0, google_ai_1.convertGoogleAIUsage)(usageMetadata, payload?.pricing),
            id: context?.id,
            type: 'usage',
        });
    }
    if (candidate && // 首先检查是否为 reasoning 内容 (thought: true)
        Array.isArray(candidate.content?.parts) &&
        candidate.content.parts.length > 0) {
        for (const part of candidate.content.parts) {
            if (part && part.text && part.thought === true) {
                return { data: part.text, id: context.id, type: 'reasoning' };
            }
        }
    }
    if (!candidate) {
        return {
            data: '',
            id: context?.id,
            type: 'text',
        };
    }
    if (candidate.content) {
        const part = candidate.content.parts?.[0];
        if (part?.functionCall) {
            const functionCall = part.functionCall;
            return [
                {
                    data: [
                        {
                            function: {
                                arguments: JSON.stringify(functionCall.args),
                                name: functionCall.name,
                            },
                            id: (0, protocol_1.generateToolCallId)(0, functionCall.name),
                            index: 0,
                            type: 'function',
                        },
                    ],
                    id: context?.id,
                    type: 'tool_calls',
                },
                ...usageChunks,
            ];
        }
        // return the grounding
        const { groundingChunks, webSearchQueries } = candidate.groundingMetadata ?? {};
        if (groundingChunks) {
            return [
                !!part?.text ? { data: part.text, id: context?.id, type: 'text' } : undefined,
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
            ].filter(Boolean);
        }
        if (candidate.finishReason) {
            if (usageMetadata) {
                return [
                    !!part?.text ? { data: part.text, id: context?.id, type: 'text' } : undefined,
                    ...usageChunks,
                ].filter(Boolean);
            }
            return { data: candidate.finishReason, id: context?.id, type: 'stop' };
        }
        return {
            data: part?.text,
            id: context?.id,
            type: 'text',
        };
    }
    return {
        data: '',
        id: context?.id,
        type: 'stop',
    };
};
const VertexAIStream = (rawStream, { callbacks, inputStartAt, enableStreaming = true, payload } = {}) => {
    const streamStack = { id: 'chat_' + (0, uuid_1.nanoid)() };
    const transformWithPayload = (chunk, ctx) => transformVertexAIStream(chunk, ctx, payload);
    return rawStream
        .pipeThrough((0, protocol_1.createTokenSpeedCalculator)(transformWithPayload, {
        enableStreaming: enableStreaming,
        inputStartAt,
        streamStack,
    }))
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)((c) => c, streamStack))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(callbacks));
};
exports.VertexAIStream = VertexAIStream;
//# sourceMappingURL=vertex-ai.js.map