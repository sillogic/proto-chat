"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeGiteeAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://ai.gitee.com/v1',
    debug: {
        chatCompletion: () => process.env.DEBUG_GITEE_AI_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const modelList = Array.isArray(modelsPage?.data)
                ? modelsPage.data
                : Array.isArray(modelsPage)
                    ? modelsPage
                    : [];
            return await (0, modelParse_1.processMultiProviderModelList)(modelList, 'giteeai');
        }
        catch (error) {
            console.warn('Failed to fetch GiteeAI models. Please ensure your GiteeAI API key is valid:', error);
            return [];
        }
    },
    provider: model_bank_1.ModelProvider.GiteeAI,
};
exports.LobeGiteeAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map