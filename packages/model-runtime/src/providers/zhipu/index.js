"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeZhipuAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
const openai_1 = require("../../core/streams/openai");
const protocol_1 = require("../../core/streams/protocol");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    chatCompletion: {
        handlePayload: (payload) => {
            const { enabledSearch, max_tokens, model, temperature, thinking, tools, top_p, ...rest } = payload;
            const zhipuTools = enabledSearch
                ? [
                    ...(tools || []),
                    {
                        type: 'web_search',
                        web_search: {
                            enable: true,
                            result_sequence: 'before', // 将搜索结果返回顺序更改为 before 适配最小化 OpenAIStream 改动
                            search_engine: process.env.ZHIPU_SEARCH_ENGINE || 'search_std', // search_std, search_pro
                            search_result: true,
                        },
                    },
                ]
                : tools;
            // Resolve parameters based on model-specific constraints
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({ max_tokens, temperature, top_p }, {
                // max_tokens constraints
                maxTokensRange: model.includes('glm-4v')
                    ? { max: 1024 }
                    : model === 'glm-zero-preview'
                        ? { max: 15300 }
                        : undefined,
                normalizeTemperature: true,
                // glm-4-alltools has stricter temperature and top_p constraints
                ...(model === 'glm-4-alltools' && {
                    temperatureRange: { max: 0.99, min: 0.01 },
                    topPRange: { max: 0.99, min: 0.01 },
                }),
            });
            return {
                ...rest,
                ...resolvedParams,
                model,
                stream: true,
                thinking: model.includes('-4.5') ? { type: thinking?.type } : undefined,
                tools: zhipuTools,
            };
        },
        handleStream: (stream, { callbacks, inputStartAt }) => {
            const readableStream = stream instanceof ReadableStream ? stream : (0, protocol_1.convertIterableToStream)(stream);
            // GLM-4.5 系列模型在 tool_calls 中返回的 index 为 -1，需要在进入 OpenAIStream 之前修正
            // 因为 OpenAIStream 内部会过滤掉 index < 0 的 tool_calls (openai.ts:58-60)
            const preprocessedStream = readableStream.pipeThrough(new TransformStream({
                transform(chunk, controller) {
                    // 处理原始的 OpenAI ChatCompletionChunk 格式
                    if (chunk.choices && chunk.choices[0]) {
                        const choice = chunk.choices[0];
                        if (choice.delta?.tool_calls && Array.isArray(choice.delta.tool_calls)) {
                            // 修正负数 index，将 -1 转换为基于数组位置的正数 index
                            const fixedToolCalls = choice.delta.tool_calls.map((toolCall, globalIndex) => ({
                                ...toolCall,
                                index: toolCall.index < 0 ? globalIndex : toolCall.index,
                            }));
                            // 创建修正后的 chunk
                            const fixedChunk = {
                                ...chunk,
                                choices: [
                                    {
                                        ...choice,
                                        delta: {
                                            ...choice.delta,
                                            tool_calls: fixedToolCalls,
                                        },
                                    },
                                ],
                            };
                            controller.enqueue(fixedChunk);
                        }
                        else {
                            controller.enqueue(chunk);
                        }
                    }
                    else {
                        controller.enqueue(chunk);
                    }
                },
            }));
            return (0, openai_1.OpenAIStream)(preprocessedStream, {
                callbacks,
                inputStartAt,
                payload: {
                    provider: 'zhipu',
                },
            });
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_ZHIPU_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        // ref: https://open.bigmodel.cn/console/modelcenter/square
        const url = 'https://open.bigmodel.cn/api/fine-tuning/model_center/list?pageSize=100&pageNum=1';
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${client.apiKey}`,
                'Bigmodel-Organization': 'lobehub',
                'Bigmodel-Project': 'lobechat',
            },
            method: 'GET',
        });
        const json = await response.json();
        const modelList = json.rows;
        const standardModelList = modelList.map((model) => ({
            description: model.description,
            displayName: model.modelName,
            id: model.modelCode,
        }));
        return (0, modelParse_1.processModelList)(standardModelList, modelParse_1.MODEL_LIST_CONFIGS.zhipu, 'zhipu');
    },
    provider: model_bank_1.ModelProvider.ZhiPu,
};
exports.LobeZhipuAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map