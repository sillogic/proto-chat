"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeXAI = exports.isGrokReasoningModel = exports.GrokReasoningModels = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.GrokReasoningModels = new Set(['grok-3-mini', 'grok-4', 'grok-code']);
const isGrokReasoningModel = (model) => Array.from(exports.GrokReasoningModels).some((id) => model.includes(id));
exports.isGrokReasoningModel = isGrokReasoningModel;
exports.LobeXAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://api.x.ai/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { enabledSearch, frequency_penalty, model, presence_penalty, ...rest } = payload;
            return {
                ...rest,
                frequency_penalty: (0, exports.isGrokReasoningModel)(model) ? undefined : frequency_penalty,
                model,
                presence_penalty: (0, exports.isGrokReasoningModel)(model) ? undefined : presence_penalty,
                stream: true,
                ...(enabledSearch && {
                    search_parameters: {
                        max_search_results: Math.min(Math.max(parseInt(process.env.XAI_MAX_SEARCH_RESULTS ?? '15', 10), 1), 30),
                        mode: 'auto',
                        return_citations: true,
                        sources: [
                            {
                                safe_search: process.env.XAI_SAFE_SEARCH === '1',
                                type: 'news',
                            },
                            /*
                            { type: 'rss' },
                            */
                            {
                                safe_search: process.env.XAI_SAFE_SEARCH === '1',
                                type: 'web',
                            },
                            { type: 'x' },
                        ],
                    },
                }),
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_XAI_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return (0, modelParse_1.processModelList)(modelList, modelParse_1.MODEL_LIST_CONFIGS.xai, 'xai');
    },
    provider: model_bank_1.ModelProvider.XAI,
});
//# sourceMappingURL=index.js.map