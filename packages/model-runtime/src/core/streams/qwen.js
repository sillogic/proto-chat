"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QwenAIStream = exports.transformQwenStream = void 0;
const usageConverters_1 = require("../usageConverters");
const protocol_1 = require("./protocol");
const transformQwenStream = (chunk, streamContext) => {
    if (Array.isArray(chunk.choices) && chunk.choices.length === 0 && chunk.usage) {
        const usage = (0, usageConverters_1.convertOpenAIUsage)({
            ...chunk.usage,
            completion_tokens_details: chunk.usage.completion_tokens_details || {},
            prompt_tokens_details: chunk.usage.prompt_tokens_details || {},
        });
        if (streamContext) {
            streamContext.usage = usage;
        }
        return { data: usage, id: chunk.id, type: 'usage' };
    }
    const item = chunk.choices[0];
    if (!item) {
        return { data: chunk, id: chunk.id, type: 'data' };
    }
    if (Array.isArray(item.delta?.content)) {
        const part = item.delta.content[0];
        const process = (part) => {
            let [key, value] = Object.entries(part)[0];
            if (key === 'image') {
                return {
                    text: `![image](${value})`,
                    type: 'text',
                };
            }
            return {
                text: value,
                type: 'text',
            };
        };
        const data = process(part);
        return {
            data: data.text,
            id: chunk.id,
            type: 'text',
        };
    }
    if (item.delta?.tool_calls) {
        return {
            data: item.delta.tool_calls.map((value, index) => ({
                function: value.function,
                id: value.id || (0, protocol_1.generateToolCallId)(index, value.function?.name),
                index: typeof value.index !== 'undefined' ? value.index : index,
                type: value.type || 'function',
            })),
            id: chunk.id,
            type: 'tool_calls',
        };
    }
    // DeepSeek reasoner will put thinking in the reasoning_content field
    if (item.delta &&
        'reasoning_content' in item.delta &&
        typeof item.delta.reasoning_content === 'string' &&
        item.delta.reasoning_content !== '') {
        return { data: item.delta.reasoning_content, id: chunk.id, type: 'reasoning' };
    }
    if (typeof item.delta?.content === 'string') {
        return { data: item.delta.content, id: chunk.id, type: 'text' };
    }
    if (item.finish_reason) {
        return { data: item.finish_reason, id: chunk.id, type: 'stop' };
    }
    if (item.delta?.content === null) {
        return { data: item.delta, id: chunk.id, type: 'data' };
    }
    return {
        data: { delta: item.delta, id: chunk.id, index: item.index },
        id: chunk.id,
        type: 'data',
    };
};
exports.transformQwenStream = transformQwenStream;
const QwenAIStream = (stream, 
// TODO: preserve for RFC 097
// eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
{ callbacks, inputStartAt, enableStreaming = true, } = {}) => {
    const streamContext = { id: '' };
    const readableStream = stream instanceof ReadableStream ? stream : (0, protocol_1.convertIterableToStream)(stream);
    return readableStream
        .pipeThrough((0, protocol_1.createTokenSpeedCalculator)(exports.transformQwenStream, {
        enableStreaming: enableStreaming,
        inputStartAt,
        streamStack: streamContext,
    }))
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)((c) => c, streamContext))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(callbacks));
};
exports.QwenAIStream = QwenAIStream;
//# sourceMappingURL=qwen.js.map