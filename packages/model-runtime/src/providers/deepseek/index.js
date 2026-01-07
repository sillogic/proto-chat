"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeDeepSeekAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api.deepseek.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            // Transform reasoning object to reasoning_content string for multi-turn conversations
            const messages = payload.messages.map((message) => {
                // Only transform if message has reasoning.content
                if (message.reasoning?.content) {
                    const { reasoning, ...rest } = message;
                    return {
                        ...rest,
                        reasoning_content: reasoning.content,
                    };
                }
                // If message has reasoning but no content, remove reasoning field entirely
                delete message.reasoning;
                return message;
            });
            return {
                ...payload,
                messages,
                stream: payload.stream ?? true,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_DEEPSEEK_CHAT_COMPLETION === '1',
    },
    // Deepseek don't support json format well
    // use Tools calling to simulate
    generateObject: {
        useToolsCalling: true,
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return (0, modelParse_1.processModelList)(modelList, modelParse_1.MODEL_LIST_CONFIGS.deepseek, 'deepseek');
    },
    provider: model_bank_1.ModelProvider.DeepSeek,
};
exports.LobeDeepSeekAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map