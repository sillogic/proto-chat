"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeGithubAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openai_1 = require("../../core/contextBuilders/openai");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const error_1 = require("../../types/error");
const modelParse_1 = require("../../utils/modelParse");
/* eslint-enable typescript-sort-keys/interface */
exports.params = {
    baseURL: 'https://models.github.ai/inference',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model } = payload;
            if (model.startsWith('o1') || model.startsWith('o3')) {
                return { ...(0, openai_1.pruneReasoningPayload)(payload), stream: false };
            }
            if (model === 'xai/grok-3-mini') {
                return { ...payload, frequency_penalty: undefined, presence_penalty: undefined };
            }
            return { ...payload, stream: payload.stream ?? true };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_GITHUB_CHAT_COMPLETION === '1',
    },
    errorType: {
        bizError: error_1.AgentRuntimeErrorType.ProviderBizError,
        invalidAPIKey: error_1.AgentRuntimeErrorType.InvalidGithubToken,
    },
    models: async () => {
        const response = await fetch('https://models.github.ai/catalog/models');
        const modelList = await response.json();
        const formattedModels = modelList.map((model) => ({
            contextWindowTokens: model.limits?.max_input_tokens + model.limits?.max_output_tokens,
            description: model.summary,
            displayName: model.name,
            functionCall: model.capabilities?.includes('tool-calling') ?? undefined,
            id: model.id,
            maxOutput: model.limits?.max_output_tokens ?? undefined,
            reasoning: model.tags?.includes('reasoning') ?? undefined,
            releasedAt: model.version && /^\d{4}-\d{2}-\d{2}$/.test(model.version) ? model.version : undefined,
            vision: (model.tags?.includes('multimodal') ||
                model.supported_input_modalities?.includes('image')) ??
                undefined,
        }));
        return await (0, modelParse_1.processMultiProviderModelList)(formattedModels, 'github');
    },
    provider: model_bank_1.ModelProvider.Github,
};
exports.LobeGithubAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map