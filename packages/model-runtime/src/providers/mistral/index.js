"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeMistralAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
exports.params = {
    baseURL: 'https://api.mistral.ai/v1',
    chatCompletion: {
        // Mistral API does not support stream_options: { include_usage: true }
        // refs: https://github.com/lobehub/lobe-chat/issues/6825
        excludeUsage: true,
        handlePayload: (payload) => {
            // Resolve parameters with normalization
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({ max_tokens: payload.max_tokens, temperature: payload.temperature, top_p: payload.top_p }, { normalizeTemperature: true });
            return {
                ...resolvedParams,
                messages: payload.messages,
                model: payload.model,
                stream: true,
                ...(payload.tools && { tools: payload.tools }),
            };
        },
        noUserId: true,
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_MISTRAL_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return modelList
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.id.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: model.max_context_length,
                description: model.description,
                displayName: knownModel?.displayName ?? undefined,
                enabled: knownModel?.enabled || false,
                functionCall: model.capabilities.function_calling,
                id: model.id,
                reasoning: knownModel?.abilities?.reasoning || false,
                vision: model.capabilities.vision,
            };
        })
            .filter(Boolean);
    },
    provider: model_bank_1.ModelProvider.Mistral,
};
exports.LobeMistralAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map