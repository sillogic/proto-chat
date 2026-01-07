"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeQwenAI = exports.QwenLegacyModels = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
const streams_1 = require("../../core/streams");
const modelParse_1 = require("../../utils/modelParse");
const createImage_1 = require("./createImage");
/*
  QwenLegacyModels: A set of legacy Qwen models that do not support presence_penalty.
  Currently, presence_penalty is only supported on Qwen commercial models and open-source models starting from Qwen 1.5 and later.
*/
exports.QwenLegacyModels = new Set([
    'qwen-72b-chat',
    'qwen-14b-chat',
    'qwen-7b-chat',
    'qwen-1.8b-chat',
    'qwen-1.8b-longcontext-chat',
]);
exports.LobeQwenAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, presence_penalty, temperature, thinking, top_p, enabledSearch, ...rest } = payload;
            // Resolve parameters with model-specific constraints
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({ presence_penalty, temperature, top_p }, {
                normalizeTemperature: false,
                presencePenaltyRange: exports.QwenLegacyModels.has(model) ? undefined : { max: 2, min: -2 },
                temperatureRange: { max: 2, min: 0 },
                topPRange: model.startsWith('qvq') || model.startsWith('qwen-vl')
                    ? { max: 1, min: 0 }
                    : { max: 1, min: 0 },
            });
            return {
                ...rest,
                ...(model.includes('-thinking')
                    ? {
                        enable_thinking: true,
                        thinking_budget: thinking?.budget_tokens === 0 ? 0 : thinking?.budget_tokens || undefined,
                    }
                    : [
                        'qwen3',
                        'qwen-turbo',
                        'qwen-plus',
                        'qwen-flash',
                        'deepseek-v3.1',
                        'deepseek-v3.2',
                        'glm',
                    ].some((keyword) => model.toLowerCase().includes(keyword))
                        ? {
                            enable_thinking: thinking !== undefined ? thinking.type === 'enabled' : false,
                            thinking_budget: thinking?.budget_tokens === 0 ? 0 : thinking?.budget_tokens || undefined,
                        }
                        : {}),
                frequency_penalty: undefined,
                model,
                presence_penalty: resolvedParams.presence_penalty,
                stream: true,
                temperature: resolvedParams.temperature,
                top_p: resolvedParams.top_p,
                ...(enabledSearch && {
                    enable_search: enabledSearch,
                    search_options: {
                        search_strategy: process.env.QWEN_SEARCH_STRATEGY || 'standard', // standard or pro
                    },
                }),
                ...(payload.tools && {
                    parallel_tool_calls: true,
                }),
            };
        },
        handleStream: streams_1.QwenAIStream,
    },
    createImage: createImage_1.createQwenImage,
    debug: {
        chatCompletion: () => process.env.DEBUG_QWEN_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return (0, modelParse_1.processMultiProviderModelList)(modelList, 'qwen');
    },
    provider: model_bank_1.ModelProvider.Qwen,
});
//# sourceMappingURL=index.js.map