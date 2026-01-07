"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeV0AI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api.v0.dev/v1',
    debug: {
        chatCompletion: () => process.env.DEBUG_V0_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const modelList = Array.isArray(modelsPage?.data)
                ? modelsPage.data
                : Array.isArray(modelsPage)
                    ? modelsPage
                    : [];
            return (0, modelParse_1.processModelList)(modelList, modelParse_1.MODEL_LIST_CONFIGS.v0, 'v0');
        }
        catch (error) {
            console.warn('Failed to fetch V0 models. Please ensure your V0 API key is valid:', error);
            return [];
        }
    },
    provider: model_bank_1.ModelProvider.V0,
};
exports.LobeV0AI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map