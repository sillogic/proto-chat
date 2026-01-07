"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformResponseAPIToStream = exports.transformResponseToStream = void 0;
/**
 * make the OpenAI response data as a stream
 */
const transformResponseToStream = (data) => new ReadableStream({
    start(controller) {
        const choices = data.choices || [];
        const first = choices[0];
        // 兼容：非流式里 DeepSeek 等会把“深度思考”放在 message.reasoning_content
        const message = first?.message ?? {};
        const reasoningText = typeof message.reasoning_content === 'string' && message.reasoning_content.length > 0
            ? message.reasoning_content
            : null;
        if (reasoningText) {
            controller.enqueue({
                choices: [
                    {
                        delta: { content: null, reasoning_content: reasoningText, role: 'assistant' },
                        finish_reason: null,
                        index: first?.index ?? 0,
                        logprobs: first?.logprobs ?? null,
                    },
                ],
                created: data.created,
                id: data.id,
                model: data.model,
                object: 'chat.completion.chunk',
            });
        }
        const chunk = {
            choices: choices.map((choice) => ({
                delta: {
                    content: choice.message.content,
                    role: choice.message.role,
                    tool_calls: choice.message.tool_calls?.map((tool, index) => ({
                        function: tool.function,
                        id: tool.id,
                        index,
                        type: tool.type,
                    })),
                },
                finish_reason: null,
                index: choice.index,
                logprobs: choice.logprobs,
            })),
            created: data.created,
            id: data.id,
            model: data.model,
            object: 'chat.completion.chunk',
        };
        controller.enqueue(chunk);
        if (data.usage) {
            controller.enqueue({
                choices: [],
                created: data.created,
                id: data.id,
                model: data.model,
                object: 'chat.completion.chunk',
                usage: data.usage,
            });
        }
        controller.enqueue({
            choices: choices.map((choice) => ({
                delta: {
                    content: null,
                    role: choice.message.role,
                },
                finish_reason: choice.finish_reason,
                index: choice.index,
                logprobs: choice.logprobs,
            })),
            created: data.created,
            id: data.id,
            model: data.model,
            object: 'chat.completion.chunk',
            system_fingerprint: data.system_fingerprint,
        });
        controller.close();
    },
});
exports.transformResponseToStream = transformResponseToStream;
/**
 * transform the OpenAI Response API data to stream format for non-streaming responses
 */
const transformResponseAPIToStream = (data) => new ReadableStream({
    start(controller) {
        // Check if output exists and is an array
        if (data.output && Array.isArray(data.output)) {
            data.output.forEach((output) => {
                switch (output.type) {
                    case 'message': {
                        // Check if content exists and is an array
                        if (output.content && Array.isArray(output.content)) {
                            output.content.forEach((content) => {
                                switch (content.type) {
                                    case 'output_text': {
                                        // Only emit delta if text exists
                                        if (content.text) {
                                            controller.enqueue({
                                                delta: content.text,
                                                type: 'response.output_text.delta',
                                            });
                                        }
                                        break;
                                    }
                                }
                            });
                        }
                        break;
                    }
                }
            });
        }
        // Always send response.completed event
        controller.enqueue({
            response: data,
            sequence_number: 999,
            type: 'response.completed',
        });
        controller.close();
    },
});
exports.transformResponseAPIToStream = transformResponseAPIToStream;
//# sourceMappingURL=nonStreamToStream.js.map