"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeMinimaxAI = exports.getMinimaxMaxOutputs = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
const createImage_1 = require("./createImage");
const getMinimaxMaxOutputs = (modelId) => {
    const model = model_bank_1.minimax.find((model) => model.id === modelId);
    return model ? model.maxOutput : undefined;
};
exports.getMinimaxMaxOutputs = getMinimaxMaxOutputs;
exports.LobeMinimaxAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://api.minimaxi.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { enabledSearch, max_tokens, messages, temperature, top_p, ...params } = payload;
            // Interleaved thinking
            const processedMessages = messages.map((message) => {
                if (message.role === 'assistant' && message.reasoning) {
                    // 只处理没有 signature 的历史推理内容
                    if (!message.reasoning.signature && message.reasoning.content) {
                        const { reasoning, ...messageWithoutReasoning } = message;
                        return {
                            ...messageWithoutReasoning,
                            reasoning_details: [
                                {
                                    format: 'MiniMax-response-v1',
                                    id: 'reasoning-text-0',
                                    index: 0,
                                    text: reasoning.content,
                                    type: 'reasoning.text',
                                },
                            ],
                        };
                    }
                    // 有 signature 或没有 content 的情况，移除 reasoning 字段
                    // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
                    const { reasoning, ...messageWithoutReasoning } = message;
                    return messageWithoutReasoning;
                }
                return message;
            });
            // Resolve parameters with constraints
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({
                max_tokens: max_tokens !== undefined ? max_tokens : (0, exports.getMinimaxMaxOutputs)(payload.model),
                temperature,
                top_p,
            }, {
                normalizeTemperature: true,
                topPRange: { max: 1, min: 0.01 },
            });
            // Minimax doesn't support temperature <= 0
            const finalTemperature = resolvedParams.temperature !== undefined && resolvedParams.temperature <= 0
                ? undefined
                : resolvedParams.temperature;
            return {
                ...params,
                max_tokens: resolvedParams.max_tokens,
                messages: processedMessages,
                reasoning_split: true,
                temperature: finalTemperature,
                top_p: resolvedParams.top_p,
            };
        },
    },
    createImage: createImage_1.createMiniMaxImage,
    debug: {
        chatCompletion: () => process.env.DEBUG_MINIMAX_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.Minimax,
});
//# sourceMappingURL=index.js.map