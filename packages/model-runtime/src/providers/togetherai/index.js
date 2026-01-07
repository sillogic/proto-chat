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
exports.LobeTogetherAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
exports.params = {
    baseURL: 'https://api.together.xyz/v1',
    constructorOptions: {
        defaultHeaders: {
            'HTTP-Referer': 'https://chat-preview.lobehub.com',
            'X-Title': 'Lobe Chat',
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_TOGETHERAI_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const visionKeywords = ['qvq', 'vision'];
        const reasoningKeywords = ['deepseek-r1', 'qwq'];
        client.baseURL = 'https://api.together.xyz/api';
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.body;
        return modelList
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.id.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: knownModel?.contextWindowTokens ?? undefined,
                description: model.description,
                displayName: model.display_name,
                enabled: knownModel?.enabled || false,
                functionCall: model.description?.toLowerCase().includes('function calling') ||
                    knownModel?.abilities?.functionCall ||
                    false,
                id: model.id,
                maxOutput: model.context_length,
                reasoning: reasoningKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)) ||
                    knownModel?.abilities?.reasoning ||
                    false,
                tokens: model.context_length,
                vision: model.description?.toLowerCase().includes('vision') ||
                    visionKeywords.some((keyword) => model.id?.toLowerCase().includes(keyword)) ||
                    knownModel?.abilities?.vision ||
                    false,
            };
        })
            .filter(Boolean);
    },
    provider: model_bank_1.ModelProvider.TogetherAI,
};
exports.LobeTogetherAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map