"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeNvidiaAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
const THINKING_MODELS = new Set(['deepseek-ai/deepseek-v3.1', 'deepseek-ai/deepseek-v3.1-terminus']);
exports.params = {
    baseURL: 'https://integrate.api.nvidia.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, thinking, ...rest } = payload;
            const thinkingFlag = thinking?.type === 'enabled' ? true : thinking?.type === 'disabled' ? false : undefined;
            return {
                ...rest,
                model,
                ...(THINKING_MODELS.has(model)
                    ? {
                        chat_template_kwargs: { thinking: thinkingFlag },
                    }
                    : {}),
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_NVIDIA_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return (0, modelParse_1.processMultiProviderModelList)(modelList, 'nvidia');
    },
    provider: model_bank_1.ModelProvider.Nvidia,
};
exports.LobeNvidiaAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map