"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeZeroOneAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api.lingyiwanwu.com/v1',
    debug: {
        chatCompletion: () => process.env.DEBUG_ZEROONE_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const modelList = Array.isArray(modelsPage?.data)
                ? modelsPage.data
                : Array.isArray(modelsPage)
                    ? modelsPage
                    : [];
            return (0, modelParse_1.processModelList)(modelList, modelParse_1.MODEL_LIST_CONFIGS.zeroone);
        }
        catch (error) {
            console.warn('Failed to fetch ZeroOne models. Please ensure your ZeroOne API key is valid:', error);
            return [];
        }
    },
    provider: model_bank_1.ModelProvider.ZeroOne,
};
exports.LobeZeroOneAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map