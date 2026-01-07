"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobePerplexityAI = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
exports.LobePerplexityAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://api.perplexity.ai',
    chatCompletion: {
        handlePayload: (payload) => {
            const { presence_penalty, frequency_penalty, stream = true, temperature, ...res } = payload;
            // Resolve parameters with constraints
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({
                frequency_penalty: presence_penalty !== 0 ? undefined : frequency_penalty || 1,
                presence_penalty: presence_penalty !== 0 ? presence_penalty : undefined,
                temperature,
            }, {
                normalizeTemperature: false,
            });
            // Perplexity doesn't support temperature >= 2
            const finalTemperature = resolvedParams.temperature !== undefined && resolvedParams.temperature >= 2
                ? undefined
                : resolvedParams.temperature;
            return {
                ...res,
                frequency_penalty: resolvedParams.frequency_penalty,
                presence_penalty: resolvedParams.presence_penalty,
                stream,
                temperature: finalTemperature,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_PERPLEXITY_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.Perplexity,
});
//# sourceMappingURL=index.js.map