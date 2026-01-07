"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeCerebrasAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api.cerebras.ai/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
            const { frequency_penalty, presence_penalty, model, ...rest } = payload;
            return {
                ...rest,
                model,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_CEREBRAS_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const modelList = Array.isArray(modelsPage?.data)
                ? modelsPage.data
                : Array.isArray(modelsPage)
                    ? modelsPage
                    : [];
            return await (0, modelParse_1.processMultiProviderModelList)(modelList, 'cerebras');
        }
        catch (error) {
            console.warn('Failed to fetch Cerebras models. Please ensure your Cerebras API key is valid:', error);
            return [];
        }
    },
    provider: model_bank_1.ModelProvider.Cerebras,
};
exports.LobeCerebrasAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map