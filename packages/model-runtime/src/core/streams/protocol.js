"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTokenSpeedCalculator = exports.TOKEN_SPEED_CHUNK_ID = exports.createSSEDataExtractor = exports.createFirstErrorHandleTransformer = exports.FIRST_CHUNK_ERROR_KEY = exports.createSSEProtocolTransformer = exports.convertIterableToStream = exports.generateToolCallId = void 0;
exports.readableFromAsyncIterable = readableFromAsyncIterable;
exports.createCallbacksTransformer = createCallbacksTransformer;
const helpers_1 = require("../../helpers");
const error_1 = require("../../types/error");
const safeParseJSON_1 = require("../../utils/safeParseJSON");
const uuid_1 = require("../../utils/uuid");
const generateToolCallId = (index, functionName) => `${functionName || 'unknown_tool_call'}_${index}_${(0, uuid_1.nanoid)()}`;
exports.generateToolCallId = generateToolCallId;
const chatStreamable = async function* (stream) {
    for await (const response of stream) {
        yield response;
    }
};
const ERROR_CHUNK_PREFIX = '%FIRST_CHUNK_ERROR%: ';
function readableFromAsyncIterable(iterable) {
    let it = iterable[Symbol.asyncIterator]();
    return new ReadableStream({
        async cancel(reason) {
            await it.return?.(reason);
        },
        async pull(controller) {
            const { done, value } = await it.next();
            if (done)
                controller.close();
            else
                controller.enqueue(value);
        },
    });
}
// make the response to the streamable format
const convertIterableToStream = (stream) => {
    const iterable = chatStreamable(stream);
    // copy from https://github.com/vercel/ai/blob/d3aa5486529e3d1a38b30e3972b4f4c63ea4ae9a/packages/ai/streams/ai-stream.ts#L284
    // and add an error handle
    let it = iterable[Symbol.asyncIterator]();
    return new ReadableStream({
        async cancel(reason) {
            await it.return?.(reason);
        },
        async pull(controller) {
            const { done, value } = await it.next();
            if (done)
                controller.close();
            else
                controller.enqueue(value);
        },
        async start(controller) {
            try {
                const { done, value } = await it.next();
                if (done)
                    controller.close();
                else
                    controller.enqueue(value);
            }
            catch (e) {
                const error = e;
                controller.enqueue((ERROR_CHUNK_PREFIX +
                    JSON.stringify({ message: error.message, name: error.name, stack: error.stack })));
                controller.close();
            }
        },
    });
};
exports.convertIterableToStream = convertIterableToStream;
/**
 * Create a transformer to convert the response into an SSE format
 */
const createSSEProtocolTransformer = (transformer, streamStack, options) => {
    let hasTerminalEvent = false;
    const requireTerminalEvent = Boolean(options?.requireTerminalEvent);
    return new TransformStream({
        flush(controller) {
            // If the upstream closes without sending a terminal event, emit a final error event
            if (requireTerminalEvent && !hasTerminalEvent) {
                const id = streamStack?.id || 'stream_end';
                const data = {
                    body: { name: 'Stream parsing error', reason: 'unexpected_end' },
                    message: 'Stream ended unexpectedly',
                    name: 'Stream parsing error',
                    type: 'StreamChunkError',
                };
                controller.enqueue(`id: ${id}\n`);
                controller.enqueue(`event: error\n`);
                controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
            }
        },
        transform: (chunk, controller) => {
            const result = transformer(chunk, streamStack || { id: '' });
            const buffers = Array.isArray(result) ? result : [result];
            buffers.forEach(({ type, id, data }) => {
                controller.enqueue(`id: ${id}\n`);
                controller.enqueue(`event: ${type}\n`);
                controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
                // mark terminal when receiving any of these events
                if (type === 'stop' || type === 'usage' || type === 'error')
                    hasTerminalEvent = true;
            });
        },
    });
};
exports.createSSEProtocolTransformer = createSSEProtocolTransformer;
function createCallbacksTransformer(cb) {
    const textEncoder = new TextEncoder();
    let aggregatedText = '';
    let aggregatedThinking = undefined;
    let usage;
    let speed;
    let grounding;
    let toolsCalling;
    let currentType = '';
    const callbacks = cb || {};
    return new TransformStream({
        async flush() {
            const data = {
                grounding,
                speed,
                text: aggregatedText,
                thinking: aggregatedThinking,
                toolsCalling,
                usage,
            };
            if (callbacks.onCompletion) {
                await callbacks.onCompletion(data);
            }
            if (callbacks.onFinal) {
                await callbacks.onFinal(data);
            }
        },
        async start() {
            if (callbacks.onStart)
                await callbacks.onStart();
        },
        async transform(chunk, controller) {
            controller.enqueue(textEncoder.encode(chunk));
            // track the type of the chunk
            if (chunk.startsWith('event:')) {
                currentType = chunk.split('event:')[1].trim();
            }
            // if the message is a data chunk, handle the callback
            else if (chunk.startsWith('data:')) {
                const content = chunk.split('data:')[1].trim();
                const data = (0, safeParseJSON_1.safeParseJSON)(content);
                if (!data)
                    return;
                switch (currentType) {
                    case 'text': {
                        aggregatedText += data;
                        await callbacks.onText?.(data);
                        break;
                    }
                    case 'reasoning': {
                        if (!aggregatedThinking) {
                            aggregatedThinking = '';
                        }
                        aggregatedThinking += data;
                        await callbacks.onThinking?.(data);
                        break;
                    }
                    case 'usage': {
                        usage = data;
                        await callbacks.onUsage?.(data);
                        break;
                    }
                    case 'speed': {
                        speed = data;
                        break;
                    }
                    case 'grounding': {
                        grounding = data;
                        await callbacks.onGrounding?.(data);
                        break;
                    }
                    case 'tool_calls': {
                        if (!toolsCalling)
                            toolsCalling = [];
                        toolsCalling = (0, helpers_1.parseToolCalls)(toolsCalling, data);
                        await callbacks.onToolsCalling?.({ chunk: data, toolsCalling });
                    }
                }
            }
        },
    });
}
exports.FIRST_CHUNK_ERROR_KEY = '_isFirstChunkError';
const createFirstErrorHandleTransformer = (errorHandler, provider) => {
    return new TransformStream({
        transform(chunk, controller) {
            if (chunk.toString().startsWith(ERROR_CHUNK_PREFIX)) {
                const errorData = JSON.parse(chunk.toString().replace(ERROR_CHUNK_PREFIX, ''));
                controller.enqueue({
                    ...errorData,
                    [exports.FIRST_CHUNK_ERROR_KEY]: true,
                    errorType: errorHandler?.(errorData) || error_1.AgentRuntimeErrorType.ProviderBizError,
                    provider,
                });
            }
            else {
                controller.enqueue(chunk);
            }
        },
    });
};
exports.createFirstErrorHandleTransformer = createFirstErrorHandleTransformer;
/**
 * create a transformer to remove SSE format data
 */
const createSSEDataExtractor = () => new TransformStream({
    transform(chunk, controller) {
        // 将 Uint8Array 转换为字符串
        const text = new TextDecoder().decode(chunk, { stream: true });
        // 处理多行数据的情况
        const lines = text.split('\n');
        for (const line of lines) {
            // 只处理以 "data: " 开头的行
            if (line.startsWith('data: ')) {
                // 提取 "data: " 后面的实际数据
                const jsonText = line.slice(6);
                // 跳过心跳消息
                if (jsonText === '[DONE]')
                    continue;
                try {
                    // 解析 JSON 数据
                    const data = JSON.parse(jsonText);
                    // 将解析后的数据传递给下一个处理器
                    controller.enqueue(data);
                }
                catch {
                    console.warn('Failed to parse SSE data:', jsonText);
                }
            }
        }
    },
});
exports.createSSEDataExtractor = createSSEDataExtractor;
exports.TOKEN_SPEED_CHUNK_ID = 'output_speed';
/**
 * Create a middleware to calculate the token generate speed
 * @requires createSSEProtocolTransformer
 */
const createTokenSpeedCalculator = (transformer, { inputStartAt, streamStack, enableStreaming = true, // 选择 TPS 计算方式（非流式时传 false）
 } = {}) => {
    let outputStartAt;
    const process = (chunk) => {
        let result = [chunk];
        // if the chunk is the first text or reasoning chunk, set as output start
        if (!outputStartAt && (chunk.type === 'text' || chunk.type === 'reasoning')) {
            outputStartAt = Date.now();
        }
        // if the chunk is the stop chunk, set as output finish
        if (inputStartAt && outputStartAt && chunk.type === 'usage') {
            // TPS should always include all generated tokens (including reasoning tokens)
            // because it measures generation speed, not just visible content
            const usage = chunk.data;
            const outputTokens = usage?.totalOutputTokens ?? 0;
            const now = Date.now();
            const elapsed = now - (enableStreaming ? outputStartAt : inputStartAt);
            const duration = now - outputStartAt;
            const latency = now - inputStartAt;
            const ttft = outputStartAt - inputStartAt;
            const tps = elapsed === 0 ? undefined : (outputTokens / elapsed) * 1000;
            result.push({
                data: {
                    duration,
                    latency,
                    tps,
                    ttft,
                },
                id: exports.TOKEN_SPEED_CHUNK_ID,
                type: 'speed',
            });
        }
        return result;
    };
    return new TransformStream({
        transform(chunk, controller) {
            let result = transformer(chunk, streamStack || { id: '' });
            if (!Array.isArray(result))
                result = [result];
            result.forEach((r) => {
                const processed = process(r);
                if (processed)
                    processed.forEach((p) => controller.enqueue(p));
            });
        },
    });
};
exports.createTokenSpeedCalculator = createTokenSpeedCalculator;
//# sourceMappingURL=protocol.js.map