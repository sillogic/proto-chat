"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeWenxinAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://qianfan.baidubce.com/v2',
    chatCompletion: {
        handlePayload: (payload) => {
            const { enabledSearch, thinking, ...rest } = payload;
            return {
                ...rest,
                stream: true,
                ...(enabledSearch && {
                    web_search: {
                        enable: true,
                        enable_citation: true,
                        enable_trace: true,
                    },
                }),
                ...(thinking && {
                    enable_thinking: { disabled: false, enabled: true }[thinking.type],
                    ...(thinking?.budget_tokens !== 0 && {
                        thinking_budget: Math.min(Math.max(thinking?.budget_tokens, 100), 16384),
                    }),
                }),
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_WENXIN_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        const standardModelList = modelList.map((model) => ({
            id: model.id,
        }));
        return (0, modelParse_1.processMultiProviderModelList)(standardModelList, 'wenxin');
    },
    provider: model_bank_1.ModelProvider.Wenxin,
};
exports.LobeWenxinAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map