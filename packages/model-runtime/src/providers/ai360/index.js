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
exports.LobeAi360AI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
exports.params = {
    baseURL: 'https://api.360.cn/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { enabledSearch, tools, ...rest } = payload;
            const ai360Tools = enabledSearch
                ? [
                    ...(tools || []),
                    {
                        type: 'web_search',
                        web_search: {
                            search_mode: 'auto',
                        },
                    },
                ]
                : tools;
            return {
                ...rest,
                stream: !ai360Tools,
                tools: ai360Tools,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_AI360_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const reasoningKeywords = ['360gpt2-o1', '360zhinao2-o1'];
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return modelList
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.id.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: model.total_tokens,
                displayName: knownModel?.displayName ?? undefined,
                enabled: knownModel?.enabled || false,
                functionCall: model.id === '360gpt-pro' || knownModel?.abilities?.functionCall || false,
                id: model.id,
                maxOutput: typeof model.max_tokens === 'number' ? model.max_tokens : undefined,
                reasoning: reasoningKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)) ||
                    knownModel?.abilities?.reasoning ||
                    false,
                vision: knownModel?.abilities?.vision || false,
            };
        })
            .filter(Boolean);
    },
    provider: model_bank_1.ModelProvider.Ai360,
};
exports.LobeAi360AI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map