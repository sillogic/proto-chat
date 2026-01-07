"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeModelScopeAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api-inference.modelscope.cn/v1',
    debug: {
        chatCompletion: () => process.env.DEBUG_MODELSCOPE_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const modelList = modelsPage.data || [];
            return await (0, modelParse_1.processMultiProviderModelList)(modelList, 'modelscope');
        }
        catch (error) {
            console.warn('Failed to fetch ModelScope models. Please ensure your ModelScope API key is valid and your Alibaba Cloud account is properly bound:', error);
            return [];
        }
    },
    provider: model_bank_1.ModelProvider.ModelScope,
};
exports.LobeModelScopeAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map