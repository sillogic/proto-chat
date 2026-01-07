"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeInfiniAI = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.LobeInfiniAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://cloud.infini-ai.com/maas/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, thinking, ...rest } = payload;
            return {
                ...rest,
                enable_thinking: thinking !== undefined ? thinking.type === 'enabled' : false,
                model,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_INFINIAI_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return (0, modelParse_1.processMultiProviderModelList)(modelList, 'infiniai');
    },
    provider: model_bank_1.ModelProvider.InfiniAI,
});
//# sourceMappingURL=index.js.map