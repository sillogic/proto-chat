"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIResponsesStream = void 0;
const error_1 = require("../../../types/error");
const usageConverters_1 = require("../../usageConverters");
const protocol_1 = require("../protocol");
const transformOpenAIStream = (chunk, streamContext, payload) => {
    // handle the first chunk error
    if (protocol_1.FIRST_CHUNK_ERROR_KEY in chunk) {
        delete chunk[protocol_1.FIRST_CHUNK_ERROR_KEY];
        // @ts-ignore
        delete chunk['name'];
        // @ts-ignore
        delete chunk['stack'];
        const errorData = {
            body: chunk,
            message: 'message' in chunk
                ? typeof chunk.message === 'string'
                    ? chunk.message
                    : JSON.stringify(chunk)
                : JSON.stringify(chunk),
            type: 'errorType' in chunk
                ? chunk.errorType
                : error_1.AgentRuntimeErrorType.ProviderBizError,
        };
        return { data: errorData, id: 'first_chunk_error', type: 'error' };
    }
    try {
        switch (chunk.type) {
            case 'response.created': {
                streamContext.id = chunk.response.id;
                streamContext.returnedCitationArray = [];
                return { data: chunk.response.status, id: streamContext.id, type: 'data' };
            }
            case 'response.output_item.added': {
                switch (chunk.item.type) {
                    case 'function_call': {
                        streamContext.toolIndex =
                            typeof streamContext.toolIndex === 'undefined' ? 0 : streamContext.toolIndex + 1;
                        streamContext.tool = {
                            id: chunk.item.call_id,
                            index: streamContext.toolIndex,
                            name: chunk.item.name,
                        };
                        return {
                            data: [
                                {
                                    function: { arguments: chunk.item.arguments, name: chunk.item.name },
                                    id: chunk.item.call_id,
                                    index: streamContext.toolIndex,
                                    type: 'function',
                                },
                            ],
                            id: streamContext.id,
                            type: 'tool_calls',
                        };
                    }
                }
                return { data: chunk.item, id: streamContext.id, type: 'data' };
            }
            case 'response.function_call_arguments.delta': {
                return {
                    data: [
                        {
                            function: { arguments: chunk.delta, name: streamContext.tool?.name },
                            id: streamContext.tool?.id,
                            index: streamContext.toolIndex,
                            type: 'function',
                        },
                    ],
                    id: streamContext.id,
                    type: 'tool_calls',
                };
            }
            case 'response.output_text.delta': {
                return { data: chunk.delta, id: chunk.item_id, type: 'text' };
            }
            case 'response.reasoning_summary_part.added': {
                if (!streamContext.startReasoning) {
                    streamContext.startReasoning = true;
                    return { data: '', id: chunk.item_id, type: 'reasoning' };
                }
                else {
                    return { data: '\n', id: chunk.item_id, type: 'reasoning' };
                }
            }
            case 'response.reasoning_summary_text.delta': {
                return { data: chunk.delta, id: chunk.item_id, type: 'reasoning' };
            }
            case 'response.output_text.annotation.added': {
                const citations = chunk.annotation;
                if (streamContext.returnedCitationArray) {
                    streamContext.returnedCitationArray.push({
                        title: citations.title,
                        url: citations.url,
                    });
                }
                return { data: null, id: chunk.item_id, type: 'text' };
            }
            case 'response.output_item.done': {
                if (streamContext.returnedCitationArray?.length) {
                    return {
                        data: { citations: streamContext.returnedCitationArray },
                        id: chunk.item.id,
                        type: 'grounding',
                    };
                }
                return { data: null, id: chunk.item.id, type: 'text' };
            }
            case 'response.completed': {
                if (chunk.response.usage) {
                    return {
                        data: (0, usageConverters_1.convertOpenAIResponseUsage)(chunk.response.usage, payload),
                        id: chunk.response.id,
                        type: 'usage',
                    };
                }
                return { data: chunk, id: streamContext.id, type: 'data' };
            }
            default: {
                return { data: chunk, id: streamContext.id, type: 'data' };
            }
        }
    }
    catch (e) {
        const errorName = 'StreamChunkError';
        console.error(`[${errorName}]`, e);
        console.error(`[${errorName}] raw chunk:`, chunk);
        const err = e;
        /* eslint-disable sort-keys-fix/sort-keys-fix */
        const errorData = {
            body: {
                message: 'chat response streaming chunk parse error, please contact your API Provider to fix it.',
                context: { error: { message: err.message, name: err.name }, chunk },
            },
            type: errorName,
        };
        /* eslint-enable */
        return { data: errorData, id: streamContext.id, type: 'error' };
    }
};
const OpenAIResponsesStream = (stream, { callbacks, bizErrorTypeTransformer, inputStartAt, enableStreaming = true, payload, } = {}) => {
    const streamStack = { id: '' };
    const readableStream = stream instanceof ReadableStream ? stream : (0, protocol_1.convertIterableToStream)(stream);
    // use closure to pass payload to transformOpenAIStream
    const transformWithPayload = (chunk, streamContext) => transformOpenAIStream(chunk, streamContext, payload);
    return (readableStream
        // 1. handle the first error if exist
        // provider like huggingface or minimax will return error in the stream,
        // so in the first Transformer, we need to handle the error
        .pipeThrough((0, protocol_1.createFirstErrorHandleTransformer)(bizErrorTypeTransformer, payload?.provider))
        .pipeThrough((0, protocol_1.createTokenSpeedCalculator)(transformWithPayload, {
        enableStreaming: enableStreaming,
        inputStartAt,
        streamStack,
    }))
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)((c) => c, streamStack))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(callbacks)));
};
exports.OpenAIResponsesStream = OpenAIResponsesStream;
//# sourceMappingURL=responsesStream.js.map