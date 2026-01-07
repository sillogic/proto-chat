"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeOllamaCloudAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://ollama.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, ...rest } = payload;
            return {
                ...rest,
                model,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_OLLAMA_CLOUD_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const modelList = Array.isArray(modelsPage?.data)
                ? modelsPage.data
                : Array.isArray(modelsPage)
                    ? modelsPage
                    : [];
            return await (0, modelParse_1.processMultiProviderModelList)(modelList, 'ollamacloud');
        }
        catch (error) {
            console.warn('Failed to fetch Ollama Cloud models. Please ensure your Ollama Cloud API key is valid:', error);
            return [];
        }
    },
    provider: model_bank_1.ModelProvider.OllamaCloud,
};
exports.LobeOllamaCloudAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map