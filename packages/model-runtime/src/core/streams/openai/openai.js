"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIStream = void 0;
const error_1 = require("../../../types/error");
const usageConverters_1 = require("../../usageConverters");
const protocol_1 = require("../protocol");
// Process markdown base64 images: extract URLs and clean text in one pass
const processMarkdownBase64Images = (text) => {
    if (!text)
        return { cleanedText: text, urls: [] };
    const urls = [];
    const mdRegex = /!\[[^\]]*]\(\s*(data:image\/[\d+.A-Za-z-]+;base64,[^\s)]+)\s*\)/g;
    let cleanedText = text;
    let m;
    // Reset regex lastIndex to ensure we start from the beginning
    mdRegex.lastIndex = 0;
    while ((m = mdRegex.exec(text)) !== null) {
        if (m[1])
            urls.push(m[1]);
    }
    // Remove all markdown base64 image segments
    cleanedText = text.replaceAll(mdRegex, '').trim();
    return { cleanedText, urls };
};
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
    // MiniMax 会在 base_resp 中返回业务错误（如余额不足），但不走 FIRST_CHUNK_ERROR_KEY
    // 典型返回：{ id: '...', choices: null, base_resp: { status_code: 1008, status_msg: 'insufficient balance' }, usage: {...} }
    if (chunk.base_resp && typeof chunk.base_resp.status_code === 'number') {
        const baseResp = chunk.base_resp;
        if (baseResp.status_code !== 0) {
            // 根据 MiniMax 错误码映射到对应的错误类型
            let errorType = error_1.AgentRuntimeErrorType.ProviderBizError;
            switch (baseResp.status_code) {
                // 1004 - 未授权 / Token 不匹配 / 2049 - 无效的 API Key
                case 1004:
                case 2049: {
                    errorType = error_1.AgentRuntimeErrorType.InvalidProviderAPIKey;
                    break;
                }
                // 1008 - 余额不足
                case 1008: {
                    errorType = error_1.AgentRuntimeErrorType.InsufficientQuota;
                    break;
                }
                // 1002 - 请求频率超限 / 1041 - 连接数限制 / 2045 - 请求频率增长超限
                case 1002:
                case 1041:
                case 2045: {
                    errorType = error_1.AgentRuntimeErrorType.QuotaLimitReached;
                    break;
                }
                // 1039 - Token 限制
                case 1039: {
                    errorType = error_1.AgentRuntimeErrorType.ExceededContextWindow;
                    break;
                }
            }
            const errorData = {
                body: { ...baseResp, provider: 'minimax' },
                message: baseResp.status_msg || baseResp.message || 'MiniMax provider error',
                type: errorType,
            };
            return { data: errorData, id: chunk.id, type: 'error' };
        }
    }
    try {
        // maybe need another structure to add support for multiple choices
        if (!Array.isArray(chunk.choices) || chunk.choices.length === 0) {
            if (chunk.usage) {
                const usage = chunk.usage;
                return { data: (0, usageConverters_1.convertOpenAIUsage)(usage, payload), id: chunk.id, type: 'usage' };
            }
            return { data: chunk, id: chunk.id, type: 'data' };
        }
        const item = chunk.choices[0];
        if (item && typeof item.delta?.tool_calls === 'object' && item.delta.tool_calls?.length > 0) {
            // tools calling
            const tool_calls = item.delta.tool_calls.filter((value) => value.index >= 0 || typeof value.index === 'undefined');
            if (tool_calls.length > 0) {
                return {
                    data: item.delta.tool_calls.map((value, index) => {
                        if (streamContext && !streamContext.tool) {
                            streamContext.tool = {
                                id: value.id,
                                index: value.index,
                                name: value.function.name,
                            };
                        }
                        return {
                            function: {
                                arguments: value.function?.arguments ?? '',
                                name: value.function?.name ?? null,
                            },
                            id: value.id ||
                                streamContext?.tool?.id ||
                                (0, protocol_1.generateToolCallId)(index, value.function?.name),
                            // mistral's tool calling don't have index and function field, it's data like:
                            // [{"id":"xbhnmTtY7","function":{"name":"lobe-image-designer____text2image____builtin","arguments":"{\"prompts\": [\"A photo of a small, fluffy dog with a playful expression and wagging tail.\", \"A watercolor painting of a small, energetic dog with a glossy coat and bright eyes.\", \"A vector illustration of a small, adorable dog with a short snout and perky ears.\", \"A drawing of a small, scruffy dog with a mischievous grin and a wagging tail.\"], \"quality\": \"standard\", \"seeds\": [123456, 654321, 111222, 333444], \"size\": \"1024x1024\", \"style\": \"vivid\"}"}}]
                            // minimax's tool calling don't have index field, it's data like:
                            // [{"id":"call_function_4752059746","type":"function","function":{"name":"lobe-image-designer____text2image____builtin","arguments":"{\"prompts\": [\"一个流浪的地球，背景是浩瀚"}}]
                            // so we need to add these default values
                            index: typeof value.index !== 'undefined' ? value.index : index,
                            type: value.type || 'function',
                        };
                    }),
                    id: chunk.id,
                    type: 'tool_calls',
                };
            }
        }
        // Handle image preview chunks (e.g. Gemini 2.5 flash image preview)
        // Example shape:
        // choices[0].delta.images = [{ type: 'image_url', image_url: { url: 'data:image/png;base64,...' }, index: 0 }]
        if (item.delta &&
            Array.isArray(item.delta.images) &&
            item.delta.images.length > 0) {
            const images = item.delta.images;
            return images
                .map((img) => {
                // support multiple possible shapes for the url
                const url = img?.image_url?.url ||
                    img?.image_url?.image_url?.url ||
                    img?.url ||
                    (typeof img === 'string' ? img : undefined);
                if (!url)
                    return null;
                return {
                    data: url,
                    id: chunk.id,
                    type: 'base64_image',
                };
            })
                .filter(Boolean);
        }
        // 给定结束原因
        if (item.finish_reason) {
            // one-api 的流式接口，会出现既有 finish_reason ，也有 content 的情况
            //  {"id":"demo","model":"deepl-en","choices":[{"index":0,"delta":{"role":"assistant","content":"Introduce yourself."},"finish_reason":"stop"}]}
            if (typeof item.delta?.content === 'string' && !!item.delta.content) {
                // MiniMax 内建搜索功能会在第一个 tools 流中 content 返回引用源，需要忽略
                // {"id":"0483748a25071c611e2f48d2982fbe96","choices":[{"finish_reason":"stop","index":0,"delta":{"content":"[{\"no\":1,\"url\":\"https://www.xiaohongshu.com/discovery/item/66d8de3c000000001f01e752\",\"title\":\"郑钦文为国而战，没有理由不坚持🏅\",\"content\":\"·2024年08月03日\\n中国队选手郑钦文夺得巴黎奥运会网球女单比赛金牌（巴黎奥运第16金）\\n#巴黎奥运会[话题]# #郑钦文[话题]# #人物素材积累[话题]# #作文素材积累[话题]# #申论素材[话题]#\",\"web_icon\":\"https://www.xiaohongshu.com/favicon.ico\"}]","role":"tool","tool_call_id":"call_function_6696730535"}}],"created":1748255114,"model":"abab6.5s-chat","object":"chat.completion.chunk","usage":{"total_tokens":0,"total_characters":0},"input_sensitive":false,"output_sensitive":false,"input_sensitive_type":0,"output_sensitive_type":0,"output_sensitive_int":0}
                if (typeof item.delta?.role === 'string' && item.delta.role === 'tool') {
                    return { data: null, id: chunk.id, type: 'text' };
                }
                const text = item.delta.content;
                const { urls: images, cleanedText: cleaned } = processMarkdownBase64Images(text);
                if (images.length > 0) {
                    const arr = [];
                    if (cleaned)
                        arr.push({ data: cleaned, id: chunk.id, type: 'text' });
                    arr.push(...images.map((url) => ({
                        data: url,
                        id: chunk.id,
                        type: 'base64_image',
                    })));
                    return arr;
                }
                return { data: text, id: chunk.id, type: 'text' };
            }
            // OpenAI Search Preview 模型返回引用源
            // {"id":"chatcmpl-18037d13-243c-4941-8b05-9530b352cf17","object":"chat.completion.chunk","created":1748351805,"model":"gpt-4o-mini-search-preview-2025-03-11","choices":[{"index":0,"delta":{"annotations":[{"type":"url_citation","url_citation":{"url":"https://zh.wikipedia.org/wiki/%E4%B8%8A%E6%B5%B7%E4%B9%90%E9%AB%98%E4%B9%90%E5%9B%AD?utm_source=openai","title":"上海乐高乐园","start_index":75,"end_index":199}}]},"finish_reason":"stop"}],"service_tier":"default"}
            if (item.delta?.annotations && item.delta.annotations.length > 0) {
                const citations = item.delta.annotations;
                return [
                    {
                        data: {
                            citations: citations.map((item) => ({
                                title: item.url_citation.title,
                                url: item.url_citation.url,
                            })),
                        },
                        id: chunk.id,
                        type: 'grounding',
                    },
                ];
            }
            // MiniMax 内建搜索功能会在最后一个流中的 message 数组中返回 4 个 Object，其中最后一个为 annotations
            // {"id":"0483bf14ba55225a66de2342a21b4003","choices":[{"finish_reason":"tool_calls","index":0,"messages":[{"content":"","role":"user","reasoning_content":""},{"content":"","role":"assistant","tool_calls":[{"id":"call_function_0872338692","type":"web_search","function":{"name":"get_search_result","arguments":"{\"query_tag\":[\"天气\"],\"query_list\":[\"上海 2025年5月26日 天气\"]}"}}],"reasoning_content":""},{"content":"","role":"tool","tool_call_id":"call_function_0872338692","reasoning_content":""},{"content":"","role":"assistant","name":"海螺AI","annotations":[{"text":"【5†source】","url":"https://mtianqi.eastday.com/tianqi/shanghai/20250526.html","quote":"上海天气预报提供上海2025年05月26日天气"}],"audio_content":"","reasoning_content":""}]}],"created":1748274196,"model":"MiniMax-Text-01","object":"chat.completion","usage":{"total_tokens":13110,"total_characters":0,"prompt_tokens":12938,"completion_tokens":172},"base_resp":{"status_code":0,"status_msg":"Invalid parameters detected, json: unknown field \"user\""}}
            if (item.messages && item.messages.length > 0) {
                const citations = item.messages.at(-1).annotations;
                return [
                    {
                        data: {
                            citations: citations.map((item) => ({
                                title: item.url,
                                url: item.url,
                            })),
                        },
                        id: chunk.id,
                        type: 'grounding',
                    },
                ];
            }
            if (chunk.usage) {
                const usage = chunk.usage;
                return { data: (0, usageConverters_1.convertOpenAIUsage)(usage, payload), id: chunk.id, type: 'usage' };
            }
            // xAI Live Search 功能返回引用源
            // {"id":"8721eebb-6465-4c47-ba2e-8e2ec0f97055","object":"chat.completion.chunk","created":1747809109,"model":"grok-3","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":"stop"}],"system_fingerprint":"fp_1affcf9872","citations":["https://world.huanqiu.com/"]}
            if (chunk.citations) {
                const citations = chunk.citations;
                return [
                    {
                        data: {
                            citations: citations.map((item) => ({
                                title: item,
                                url: item,
                            })),
                        },
                        id: chunk.id,
                        type: 'grounding',
                    },
                ];
            }
            return { data: item.finish_reason, id: chunk.id, type: 'stop' };
        }
        if (item.delta) {
            let reasoning_content = (() => {
                if ('reasoning_content' in item.delta)
                    return item.delta.reasoning_content;
                if ('reasoning' in item.delta)
                    return item.delta.reasoning;
                // Handle MiniMax M2 reasoning_details format (array of objects with text field)
                if ('reasoning_details' in item.delta) {
                    const details = item.delta.reasoning_details;
                    if (Array.isArray(details)) {
                        return details
                            .filter((detail) => detail.text)
                            .map((detail) => detail.text)
                            .join('');
                    }
                    if (typeof details === 'string') {
                        return details;
                    }
                    if (typeof details === 'object' && details !== null && 'text' in details) {
                        return details.text;
                    }
                    // Fallback for unexpected types
                    return '';
                }
                // Handle content array format with thinking blocks (e.g. mistral AI Magistral model)
                if ('content' in item.delta && Array.isArray(item.delta.content)) {
                    return item.delta.content
                        .filter((block) => block.type === 'thinking' && Array.isArray(block.thinking))
                        .map((block) => block.thinking
                        .filter((thinkItem) => thinkItem.type === 'text' && thinkItem.text)
                        .map((thinkItem) => thinkItem.text)
                        .join(''))
                        .join('');
                }
                return null;
            })();
            let content = 'content' in item.delta ? item.delta.content : null;
            // DeepSeek reasoner will put thinking in the reasoning_content field
            // litellm and not set content = null when processing reasoning content
            // en: siliconflow and aliyun bailian has encountered a situation where both content and reasoning_content are present, so need to handle it
            // refs: https://github.com/lobehub/lobe-chat/issues/5681 (siliconflow)
            // refs: https://github.com/lobehub/lobe-chat/issues/5956 (aliyun bailian)
            if (typeof content === 'string' && typeof reasoning_content === 'string') {
                if (content === '' && reasoning_content === '') {
                    content = null;
                }
                else if (reasoning_content === '') {
                    reasoning_content = null;
                }
            }
            if (typeof reasoning_content === 'string') {
                return { data: reasoning_content, id: chunk.id, type: 'reasoning' };
            }
            if (typeof content === 'string') {
                // 如果 content 是空字符串但 chunk 带有 usage，则优先返回 usage（例如 Gemini image-preview 最终会在单独的 chunk 中返回 usage）
                if (content === '' && chunk.usage) {
                    const usage = chunk.usage;
                    return { data: (0, usageConverters_1.convertOpenAIUsage)(usage, payload), id: chunk.id, type: 'usage' };
                }
                // 处理包含 </think> 标签的特殊情况：需要分割内容
                if (content.includes('</think>')) {
                    const parts = content.split('</think>');
                    const beforeThink = parts[0].replaceAll('<think>', ''); // 移除可能的 <think> 标签
                    const afterThink = parts.slice(1).join('</think>'); // 处理可能有多个 </think> 的情况
                    const results = [];
                    // </think> 之前的内容（如果有）作为 reasoning
                    if (beforeThink) {
                        results.push({
                            data: beforeThink,
                            id: chunk.id,
                            type: 'reasoning',
                        });
                    }
                    // 更新状态：已经结束思考模式
                    streamContext.thinkingInContent = false;
                    // </think> 之后的内容（如果有）作为 text
                    if (afterThink) {
                        results.push({
                            data: afterThink,
                            id: chunk.id,
                            type: 'text',
                        });
                    }
                    return results.length > 0 ? results : { data: '', id: chunk.id, type: 'text' };
                }
                // 清除 <think> 标签（不需要分割，因为 <think> 标签后续内容都是 reasoning）
                const thinkingContent = content.replaceAll(/<\/?think>/g, '');
                // 判断是否有 <think> 标签，更新 thinkingInContent 状态
                if (content.includes('<think>')) {
                    streamContext.thinkingInContent = true;
                }
                // 判断是否有 citations 内容，更新 returnedCitation 状态
                if (!streamContext?.returnedCitation) {
                    const citations = 
                    // in Perplexity api, the citation is in every chunk, but we only need to return it once
                    ('citations' in chunk && chunk.citations) ||
                        // in Hunyuan api, the citation is in every chunk
                        ('search_info' in chunk && chunk.search_info?.search_results) ||
                        // in Wenxin api, the citation is in the first and last chunk
                        ('search_results' in chunk && chunk.search_results) ||
                        // in Zhipu api, the citation is in the first chunk
                        ('web_search' in chunk && chunk.web_search);
                    if (citations) {
                        streamContext.returnedCitation = true;
                        const baseChunks = [
                            {
                                data: {
                                    citations: citations
                                        .map((item) => ({
                                        title: typeof item === 'string' ? item : item.title,
                                        url: typeof item === 'string' ? item : item.url || item.link,
                                    }))
                                        .filter((c) => c.title && c.url), // Zhipu 内建搜索工具有时会返回空 link 引发程序崩溃
                                },
                                id: chunk.id,
                                type: 'grounding',
                            },
                            {
                                data: thinkingContent,
                                id: chunk.id,
                                type: streamContext?.thinkingInContent ? 'reasoning' : 'text',
                            },
                        ];
                        return baseChunks;
                    }
                }
                // 非思考模式下，额外解析 markdown 中的 base64 图片，按顺序输出 text -> base64_image
                if (!streamContext?.thinkingInContent) {
                    const { urls, cleanedText: cleaned } = processMarkdownBase64Images(thinkingContent);
                    if (urls.length > 0) {
                        const arr = [];
                        if (cleaned)
                            arr.push({ data: cleaned, id: chunk.id, type: 'text' });
                        arr.push(...urls.map((url) => ({
                            data: url,
                            id: chunk.id,
                            type: 'base64_image',
                        })));
                        return arr;
                    }
                }
                // 根据当前思考模式确定返回类型
                return {
                    data: thinkingContent,
                    id: chunk.id,
                    type: streamContext?.thinkingInContent ? 'reasoning' : 'text',
                };
            }
        }
        // 无内容情况
        if (item.delta && item.delta.content === null) {
            return { data: item.delta, id: chunk.id, type: 'data' };
        }
        // litellm 的返回结果中，存在 delta 为空，但是有 usage 的情况
        if (chunk.usage) {
            const usage = chunk.usage;
            return { data: (0, usageConverters_1.convertOpenAIUsage)(usage, payload), id: chunk.id, type: 'usage' };
        }
        // 其余情况下，返回 delta 和 index
        return {
            data: { delta: item.delta, id: chunk.id, index: item.index },
            id: chunk.id,
            type: 'data',
        };
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
        return { data: errorData, id: chunk.id, type: 'error' };
    }
};
const OpenAIStream = (stream, { callbacks, bizErrorTypeTransformer, payload, inputStartAt, enableStreaming = true, } = {}) => {
    const streamStack = {
        id: '',
    };
    const transformWithProvider = (chunk, streamContext) => transformOpenAIStream(chunk, streamContext, payload);
    const readableStream = stream instanceof ReadableStream ? stream : (0, protocol_1.convertIterableToStream)(stream);
    return (readableStream
        // 1. handle the first error if exist
        // provider like huggingface or minimax will return error in the stream,
        // so in the first Transformer, we need to handle the error
        .pipeThrough((0, protocol_1.createFirstErrorHandleTransformer)(bizErrorTypeTransformer, payload?.provider))
        .pipeThrough((0, protocol_1.createTokenSpeedCalculator)(transformWithProvider, {
        enableStreaming: enableStreaming,
        inputStartAt,
        streamStack,
    }))
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)((c) => c, streamStack))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(callbacks)));
};
exports.OpenAIStream = OpenAIStream;
//# sourceMappingURL=openai.js.map