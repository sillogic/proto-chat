"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicStream = exports.transformAnthropicStream = void 0;
const usageConverters_1 = require("../usageConverters");
const protocol_1 = require("./protocol");
const transformAnthropicStream = (chunk, context, payload) => {
    // maybe need another structure to add support for multiple choices
    switch (chunk.type) {
        case 'message_start': {
            context.id = chunk.message.id;
            context.returnedCitationArray = [];
            const usage = (0, usageConverters_1.convertAnthropicUsage)(chunk, undefined, payload);
            if (usage) {
                context.usage = usage;
            }
            else {
                delete context.usage;
            }
            return { data: chunk.message, id: chunk.message.id, type: 'data' };
        }
        case 'content_block_start': {
            switch (chunk.content_block.type) {
                case 'redacted_thinking': {
                    return {
                        data: chunk.content_block.data,
                        id: context.id,
                        type: 'flagged_reasoning_signature',
                    };
                }
                case 'text': {
                    return { data: chunk.content_block.text, id: context.id, type: 'data' };
                }
                case 'server_tool_use':
                case 'tool_use': {
                    const toolChunk = chunk.content_block;
                    // if toolIndex is not defined, set it to 0
                    if (typeof context.toolIndex === 'undefined') {
                        context.toolIndex = 0;
                    }
                    // if toolIndex is defined, increment it
                    else {
                        context.toolIndex += 1;
                    }
                    const toolCall = {
                        function: {
                            arguments: '',
                            name: toolChunk.name,
                        },
                        id: toolChunk.id,
                        index: context.toolIndex,
                        type: 'function',
                    };
                    context.tool = { id: toolChunk.id, index: context.toolIndex, name: toolChunk.name };
                    return { data: [toolCall], id: context.id, type: 'tool_calls' };
                }
                /*
                case 'web_search_tool_result': {
                  const citations = chunk.content_block.content;
        
                  return [
                    {
                      data: {
                        citations: (citations as any[]).map(
                          (item) =>
                            ({
                              title: item.title,
                              url: item.url,
                            }) as CitationItem,
                        ),
                      },
                      id: context.id,
                      type: 'grounding',
                    },
                  ];
                }
                */
                case 'thinking': {
                    const thinkingChunk = chunk.content_block;
                    // if there is signature in the thinking block, return both thinking and signature
                    if (!!thinkingChunk.signature) {
                        return [
                            { data: thinkingChunk.thinking, id: context.id, type: 'reasoning' },
                            { data: thinkingChunk.signature, id: context.id, type: 'reasoning_signature' },
                        ];
                    }
                    if (typeof thinkingChunk.thinking === 'string')
                        return { data: thinkingChunk.thinking, id: context.id, type: 'reasoning' };
                    return { data: thinkingChunk, id: context.id, type: 'data' };
                }
                default: {
                    break;
                }
            }
            return { data: chunk, id: context.id, type: 'data' };
        }
        case 'content_block_delta': {
            switch (chunk.delta.type) {
                case 'text_delta': {
                    return { data: chunk.delta.text, id: context.id, type: 'text' };
                }
                case 'input_json_delta': {
                    const delta = chunk.delta.partial_json;
                    const toolCall = {
                        function: { arguments: delta },
                        index: context.toolIndex || 0,
                        type: 'function',
                    };
                    return {
                        data: [toolCall],
                        id: context.id,
                        type: 'tool_calls',
                    };
                }
                case 'signature_delta': {
                    return {
                        data: chunk.delta.signature,
                        id: context.id,
                        type: 'reasoning_signature',
                    };
                }
                case 'thinking_delta': {
                    return {
                        data: chunk.delta.thinking,
                        id: context.id,
                        type: 'reasoning',
                    };
                }
                case 'citations_delta': {
                    const citations = chunk.delta.citation;
                    if (context.returnedCitationArray) {
                        context.returnedCitationArray.push({
                            title: citations.title,
                            url: citations.url,
                        });
                    }
                    return { data: null, id: context.id, type: 'text' };
                }
                default: {
                    break;
                }
            }
            return { data: chunk, id: context.id, type: 'data' };
        }
        case 'message_delta': {
            const aggregatedUsage = (0, usageConverters_1.convertAnthropicUsage)(chunk, context.usage, payload);
            if (aggregatedUsage) {
                context.usage = aggregatedUsage;
            }
            if (aggregatedUsage && (aggregatedUsage.totalTokens ?? 0) > 0) {
                return [
                    { data: chunk.delta.stop_reason, id: context.id, type: 'stop' },
                    { data: aggregatedUsage, id: context.id, type: 'usage' },
                ];
            }
            return { data: chunk.delta.stop_reason, id: context.id, type: 'stop' };
        }
        case 'message_stop': {
            return [
                ...(context.returnedCitationArray?.length
                    ? [
                        {
                            data: { citations: context.returnedCitationArray },
                            id: context.id,
                            type: 'grounding',
                        },
                    ]
                    : []),
                { data: 'message_stop', id: context.id, type: 'stop' },
            ];
        }
        default: {
            return { data: chunk, id: context.id, type: 'data' };
        }
    }
};
exports.transformAnthropicStream = transformAnthropicStream;
const AnthropicStream = (stream, { callbacks, inputStartAt, enableStreaming = true, payload } = {}) => {
    const streamStack = { id: '' };
    const readableStream = stream instanceof ReadableStream ? stream : (0, protocol_1.convertIterableToStream)(stream);
    const transformWithPayload = (chunk, ctx) => (0, exports.transformAnthropicStream)(chunk, ctx, payload);
    return readableStream
        .pipeThrough((0, protocol_1.createTokenSpeedCalculator)(transformWithPayload, {
        enableStreaming: enableStreaming,
        inputStartAt,
        streamStack,
    }))
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)((c) => c, streamStack))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(callbacks));
};
exports.AnthropicStream = AnthropicStream;
//# sourceMappingURL=anthropic.js.map