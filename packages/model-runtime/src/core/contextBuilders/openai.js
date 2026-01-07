"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertImageUrlToFile = exports.pruneReasoningPayload = exports.convertOpenAIResponseInputs = exports.convertOpenAIMessages = exports.convertMessageContent = void 0;
const utils_1 = require("@lobechat/utils");
const openai_1 = require("openai");
const models_1 = require("../../const/models");
const uriParser_1 = require("../../utils/uriParser");
const convertMessageContent = async (content) => {
    if (content.type === 'image_url') {
        const { type } = (0, uriParser_1.parseDataUri)(content.image_url.url);
        if (type === 'url' && process.env.LLM_VISION_IMAGE_USE_BASE64 === '1') {
            const { base64, mimeType } = await (0, utils_1.imageUrlToBase64)(content.image_url.url);
            return {
                ...content,
                image_url: { ...content.image_url, url: `data:${mimeType};base64,${base64}` },
            };
        }
    }
    return content;
};
exports.convertMessageContent = convertMessageContent;
const convertOpenAIMessages = async (messages) => {
    return (await Promise.all(messages.map(async (message) => {
        const msg = message;
        // Explicitly map only valid ChatCompletionMessageParam fields
        // Exclude reasoning and reasoning_content fields as they should not be sent in requests
        const result = {
            content: typeof message.content === 'string'
                ? message.content
                : await Promise.all((message.content || []).map((c) => (0, exports.convertMessageContent)(c))),
            role: msg.role,
        };
        // Add optional fields if they exist
        if (msg.name !== undefined)
            result.name = msg.name;
        if (msg.tool_calls !== undefined)
            result.tool_calls = msg.tool_calls;
        if (msg.tool_call_id !== undefined)
            result.tool_call_id = msg.tool_call_id;
        if (msg.function_call !== undefined)
            result.function_call = msg.function_call;
        // it's compatible for DeepSeek & Moonshot
        if (msg.reasoning_content !== undefined)
            result.reasoning_content = msg.reasoning_content;
        // MiniMax uses reasoning_details for historical thinking, so forward it unchanged
        if (msg.reasoning_details !== undefined)
            result.reasoning_details = msg.reasoning_details;
        return result;
    })));
};
exports.convertOpenAIMessages = convertOpenAIMessages;
const convertOpenAIResponseInputs = async (messages) => {
    let input = [];
    await Promise.all(messages.map(async (message) => {
        // if message has reasoning, add it as a separate reasoning item
        if (message.reasoning?.content) {
            input.push({
                summary: [{ text: message.reasoning.content, type: 'summary_text' }],
                type: 'reasoning',
            });
        }
        // if message is assistant messages with tool calls , transform it to function type item
        if (message.role === 'assistant' && message.tool_calls && message.tool_calls?.length > 0) {
            message.tool_calls?.forEach((tool) => {
                input.push({
                    arguments: tool.function.name,
                    call_id: tool.id,
                    name: tool.function.name,
                    type: 'function_call',
                });
            });
            return;
        }
        if (message.role === 'tool') {
            input.push({
                call_id: message.tool_call_id,
                output: message.content,
                type: 'function_call_output',
            });
            return;
        }
        if (message.role === 'system') {
            input.push({ ...message, role: 'developer' });
            return;
        }
        // default item
        // also need handle image
        const item = {
            ...message,
            content: typeof message.content === 'string'
                ? message.content
                : await Promise.all((message.content || []).map(async (c) => {
                    if (c.type === 'text') {
                        return { ...c, type: 'input_text' };
                    }
                    const image = await (0, exports.convertMessageContent)(c);
                    return {
                        image_url: image.image_url?.url,
                        type: 'input_image',
                    };
                })),
        };
        // remove reasoning field from the message item
        delete item.reasoning;
        input.push(item);
    }));
    return input;
};
exports.convertOpenAIResponseInputs = convertOpenAIResponseInputs;
const pruneReasoningPayload = (payload) => {
    const shouldStream = !models_1.disableStreamModels.has(payload.model);
    const { stream_options, ...cleanedPayload } = payload;
    // When reasoning_effort is 'none', allow user-defined temperature/top_p
    const effort = payload.reasoning?.effort || payload.reasoning_effort;
    const isEffortNone = effort === 'none';
    return {
        ...cleanedPayload,
        frequency_penalty: 0,
        messages: payload.messages.map((message) => ({
            ...message,
            role: message.role === 'system'
                ? models_1.systemToUserModels.has(payload.model)
                    ? 'user'
                    : 'developer'
                : message.role,
        })),
        presence_penalty: 0,
        stream: shouldStream,
        // Only include stream_options when stream is enabled
        ...(shouldStream && stream_options && { stream_options }),
        /**
         *  In openai docs: https://platform.openai.com/docs/guides/latest-model#gpt-5-2-parameter-compatibility
         *  Fields like `top_p`, `temperature` and `logprobs` only supported to
         *  GPT-5 series (e.g. 5-mini 5-nano ) when reasoning effort is none
         */
        temperature: isEffortNone ? payload.temperature : undefined,
        top_p: isEffortNone ? payload.top_p : undefined,
    };
};
exports.pruneReasoningPayload = pruneReasoningPayload;
/**
 * Convert image URL (data URL or HTTP URL) to File object for OpenAI API
 */
const convertImageUrlToFile = async (imageUrl) => {
    let buffer;
    let mimeType;
    if (imageUrl.startsWith('data:')) {
        // a base64 image
        const [mimeTypePart, base64Data] = imageUrl.split(',');
        mimeType = mimeTypePart.split(':')[1].split(';')[0];
        buffer = Buffer.from(base64Data, 'base64');
    }
    else {
        // a http url
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image from ${imageUrl}: ${response.statusText}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get('content-type') || 'image/png';
    }
    return (0, openai_1.toFile)(buffer, `image.${mimeType.split('/')[1]}`, { type: mimeType });
};
exports.convertImageUrlToFile = convertImageUrlToFile;
//# sourceMappingURL=openai.js.map