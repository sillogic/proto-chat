"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeMoonshotAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api.moonshot.cn/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { enabledSearch, messages, temperature, tools, ...rest } = payload;
            const filteredMessages = messages.map((message) => {
                let normalizedMessage = message;
                // 为 assistant 空消息添加一个空格 (#8418)
                if (message.role === 'assistant' && (!message.content || message.content === '')) {
                    normalizedMessage = { ...normalizedMessage, content: ' ' };
                }
                // Interleaved thinking
                if (message.role === 'assistant' && message.reasoning) {
                    const { reasoning, ...messageWithoutReasoning } = normalizedMessage;
                    return {
                        ...messageWithoutReasoning,
                        ...(!reasoning.signature && reasoning.content
                            ? { reasoning_content: reasoning.content }
                            : {}),
                    };
                }
                return normalizedMessage;
            });
            const moonshotTools = enabledSearch
                ? [
                    ...(tools || []),
                    {
                        function: {
                            name: '$web_search',
                        },
                        type: 'builtin_function',
                    },
                ]
                : tools;
            // Resolve parameters with normalization
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({ temperature }, { normalizeTemperature: true });
            return {
                ...rest,
                messages: filteredMessages,
                temperature: resolvedParams.temperature,
                tools: moonshotTools,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_MOONSHOT_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return (0, modelParse_1.processModelList)(modelList, modelParse_1.MODEL_LIST_CONFIGS.moonshot, 'moonshot');
    },
    provider: model_bank_1.ModelProvider.Moonshot,
};
exports.LobeMoonshotAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map