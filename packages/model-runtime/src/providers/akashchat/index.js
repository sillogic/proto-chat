"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeAkashChatAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
const THINKING_MODELS = new Set(['DeepSeek-V3-1']);
exports.params = {
    baseURL: 'https://chatapi.akash.network/api/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, thinking, ...rest } = payload;
            const thinkingFlag = thinking?.type === 'enabled' ? true : thinking?.type === 'disabled' ? false : undefined;
            return {
                ...rest,
                allowed_openai_params: ['reasoning_effort'],
                cache: { 'no-cache': true },
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
        chatCompletion: () => process.env.DEBUG_AKASH_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const rawList = modelsPage.data || [];
            // Remove `created` field from each model item
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const modelList = rawList.map(({ created: _, ...rest }) => rest);
            return await (0, modelParse_1.processMultiProviderModelList)(modelList, 'akashchat');
        }
        catch (error) {
            console.warn('Failed to fetch AkashChat models. Please ensure your AkashChat API key is valid:', error);
            return [];
        }
    },
    provider: model_bank_1.ModelProvider.AkashChat,
};
exports.LobeAkashChatAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map