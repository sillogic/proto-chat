"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeCometAPIAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api.cometapi.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, ...rest } = payload;
            return {
                ...rest,
                model,
                stream: true,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_COMETAPI_COMPLETION === '1',
    },
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const rawList = modelsPage.data || [];
            // 处理模型列表，移除不必要的字段
            const modelList = rawList.map((model) => ({
                id: model.id,
                object: model.object,
                owned_by: model.owned_by,
            }));
            return await (0, modelParse_1.processMultiProviderModelList)(modelList, 'cometapi');
        }
        catch (error) {
            console.warn('Failed to fetch CometAPI models. Please ensure your CometAPI API key is valid:', error);
            return [];
        }
    },
    provider: model_bank_1.ModelProvider.CometAPI,
};
exports.LobeCometAPIAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map