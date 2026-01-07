"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSearchTool = exports.buildAnthropicTools = exports.buildAnthropicMessages = exports.buildAnthropicMessage = exports.buildAnthropicBlock = void 0;
const utils_1 = require("@lobechat/utils");
const uriParser_1 = require("../../utils/uriParser");
const buildAnthropicBlock = async (content) => {
    switch (content.type) {
        case 'thinking': {
            // just pass-through the content
            return content;
        }
        case 'text': {
            if (!!content.text)
                return content;
            return undefined;
        }
        case 'image_url': {
            const { mimeType, base64, type } = (0, uriParser_1.parseDataUri)(content.image_url.url);
            if (type === 'base64')
                return {
                    source: {
                        data: base64,
                        media_type: mimeType,
                        type: 'base64',
                    },
                    type: 'image',
                };
            if (type === 'url') {
                const { base64, mimeType } = await (0, utils_1.imageUrlToBase64)(content.image_url.url);
                return {
                    source: {
                        data: base64,
                        media_type: mimeType,
                        type: 'base64',
                    },
                    type: 'image',
                };
            }
            throw new Error(`Invalid image URL: ${content.image_url.url}`);
        }
    }
};
exports.buildAnthropicBlock = buildAnthropicBlock;
const buildArrayContent = async (content) => {
    let messageContent = (await Promise.all(content.map(async (c) => await (0, exports.buildAnthropicBlock)(c))));
    messageContent = messageContent.filter(Boolean);
    return messageContent;
};
const buildAnthropicMessage = async (message) => {
    const content = message.content;
    switch (message.role) {
        case 'system': {
            return { content: content, role: 'user' };
        }
        case 'user': {
            return {
                content: typeof content === 'string' ? content : await buildArrayContent(content),
                role: 'user',
            };
        }
        case 'tool': {
            // refs: https://docs.anthropic.com/claude/docs/tool-use#tool-use-and-tool-result-content-blocks
            return {
                content: [
                    {
                        content: message.content,
                        tool_use_id: message.tool_call_id,
                        type: 'tool_result',
                    },
                ],
                role: 'user',
            };
        }
        case 'assistant': {
            // if there is tool_calls , we need to covert the tool_calls to tool_use content block
            // refs: https://docs.anthropic.com/claude/docs/tool-use#tool-use-and-tool-result-content-blocks
            if (message.tool_calls && message.tool_calls.length > 0) {
                const rawContent = typeof content === 'string'
                    ? [{ text: message.content, type: 'text' }]
                    : content;
                const messageContent = await buildArrayContent(rawContent);
                return {
                    content: [
                        // avoid empty text content block
                        ...messageContent,
                        ...message.tool_calls.map((tool) => ({
                            id: tool.id,
                            input: JSON.parse(tool.function.arguments),
                            name: tool.function.name,
                            type: 'tool_use',
                        })),
                    ].filter(Boolean),
                    role: 'assistant',
                };
            }
            // or it's a plain assistant message
            return { content: content, role: 'assistant' };
        }
        case 'function': {
            return { content: content, role: 'assistant' };
        }
    }
};
exports.buildAnthropicMessage = buildAnthropicMessage;
const buildAnthropicMessages = async (oaiMessages, options = {}) => {
    const messages = [];
    let pendingToolResults = [];
    // 首先收集所有 assistant 消息中的 tool_call_id 以便后续查找
    const validToolCallIds = new Set();
    for (const message of oaiMessages) {
        if (message.role === 'assistant' && message.tool_calls?.length) {
            message.tool_calls.forEach((call) => {
                if (call.id) {
                    validToolCallIds.add(call.id);
                }
            });
        }
    }
    for (const message of oaiMessages) {
        const index = oaiMessages.indexOf(message);
        // refs: https://docs.anthropic.com/claude/docs/tool-use#tool-use-and-tool-result-content-blocks
        if (message.role === 'tool') {
            // 检查这个工具消息是否有对应的 assistant 工具调用
            if (message.tool_call_id && validToolCallIds.has(message.tool_call_id)) {
                pendingToolResults.push({
                    content: [{ text: message.content, type: 'text' }],
                    tool_use_id: message.tool_call_id,
                    type: 'tool_result',
                });
                // 如果这是最后一个消息或者下一个消息不是 'tool'，则添加累积的工具结果作为一个 'user' 消息
                if (index === oaiMessages.length - 1 || oaiMessages[index + 1].role !== 'tool') {
                    messages.push({
                        content: pendingToolResults,
                        role: 'user',
                    });
                    pendingToolResults = [];
                }
            }
            else {
                // 如果工具消息没有对应的 assistant 工具调用，则作为普通文本处理
                messages.push({
                    content: message.content,
                    role: 'user',
                });
            }
        }
        else {
            const anthropicMessage = await (0, exports.buildAnthropicMessage)(message);
            messages.push({ ...anthropicMessage, role: anthropicMessage.role });
        }
    }
    const lastMessage = messages.at(-1);
    if (options.enabledContextCaching && !!lastMessage) {
        if (typeof lastMessage.content === 'string') {
            lastMessage.content = [
                {
                    cache_control: { type: 'ephemeral' },
                    text: lastMessage.content,
                    type: 'text',
                },
            ];
        }
        else {
            const lastContent = lastMessage.content.at(-1);
            if (lastContent &&
                lastContent.type !== 'thinking' &&
                lastContent.type !== 'redacted_thinking') {
                lastContent.cache_control = { type: 'ephemeral' };
            }
        }
    }
    return messages;
};
exports.buildAnthropicMessages = buildAnthropicMessages;
const buildAnthropicTools = (tools, options = {}) => {
    if (!tools)
        return;
    return tools.map((tool, index) => ({
        cache_control: options.enabledContextCaching && index === tools.length - 1
            ? { type: 'ephemeral' }
            : undefined,
        description: tool.function.description,
        input_schema: tool.function.parameters,
        name: tool.function.name,
    }));
};
exports.buildAnthropicTools = buildAnthropicTools;
const buildSearchTool = () => {
    const maxUses = process.env.ANTHROPIC_MAX_USES;
    return {
        name: 'web_search',
        type: 'web_search_20250305',
        ...(maxUses &&
            Number.isInteger(Number(maxUses)) &&
            Number(maxUses) > 0 && {
            max_uses: Number(maxUses),
        }),
    };
};
exports.buildSearchTool = buildSearchTool;
//# sourceMappingURL=anthropic.js.map