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
exports.LobeCohereAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
exports.params = {
    baseURL: 'https://api.cohere.ai/compatibility/v1',
    chatCompletion: {
        // https://docs.cohere.com/v2/docs/compatibility-api#unsupported-parameters
        excludeUsage: true,
        handlePayload: (payload) => {
            const { frequency_penalty, presence_penalty, top_p, ...rest } = payload;
            // Resolve parameters with range constraints
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({ frequency_penalty, presence_penalty, top_p }, {
                frequencyPenaltyRange: { max: 1, min: 0 },
                normalizeTemperature: false,
                presencePenaltyRange: { max: 1, min: 0 },
                topPRange: { max: 1, min: 0 },
            });
            return {
                ...rest,
                ...resolvedParams,
            };
        },
        noUserId: true,
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_COHERE_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        client.baseURL = 'https://api.cohere.com/v1';
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.body.models;
        return modelList
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.name.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: model.context_length,
                displayName: knownModel?.displayName ?? undefined,
                enabled: knownModel?.enabled || false,
                functionCall: (model.features && model.features.includes('tools')) ||
                    knownModel?.abilities?.functionCall ||
                    false,
                id: model.name,
                vision: model.supports_vision || knownModel?.abilities?.vision || false,
            };
        })
            .filter(Boolean);
    },
    provider: model_bank_1.ModelProvider.Cohere,
};
exports.LobeCohereAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map