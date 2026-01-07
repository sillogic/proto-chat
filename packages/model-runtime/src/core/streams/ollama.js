"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaStream = void 0;
const uuid_1 = require("../../utils/uuid");
const protocol_1 = require("./protocol");
const transformOllamaStream = (chunk, stack) => {
    if (chunk.message.thinking) {
        return { data: chunk.message.thinking, id: stack.id, type: 'reasoning' };
    }
    if (chunk.message.tool_calls && chunk.message.tool_calls.length > 0) {
        return {
            data: chunk.message.tool_calls.map((value, index) => ({
                function: {
                    arguments: JSON.stringify(value.function?.arguments) ?? '{}',
                    name: value.function?.name ?? null,
                },
                id: (0, protocol_1.generateToolCallId)(index, value.function?.name),
                index: index,
                type: 'function',
            })),
            id: stack.id,
            type: 'tool_calls',
        };
    }
    // maybe need another structure to add support for multiple choices
    if (chunk.done && !chunk.message.content) {
        return { data: 'finished', id: stack.id, type: 'stop' };
    }
    // 判断是否有 <think> 或 </think> 标签，更新 thinkingInContent 状态
    if (chunk.message.content.includes('<think>')) {
        stack.thinkingInContent = true;
    }
    else if (chunk.message.content.includes('</think>')) {
        stack.thinkingInContent = false;
    }
    // 清除 <think> 及 </think> 标签，并根据当前思考模式确定返回类型
    return {
        data: chunk.message.content.replaceAll(/<\/?think>/g, ''),
        id: stack.id,
        type: stack?.thinkingInContent ? 'reasoning' : 'text',
    };
};
const OllamaStream = (res, cb) => {
    const streamStack = { id: 'chat_' + (0, uuid_1.nanoid)() };
    return res
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)(transformOllamaStream, streamStack))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(cb));
};
exports.OllamaStream = OllamaStream;
//# sourceMappingURL=ollama.js.map