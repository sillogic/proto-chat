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
exports.LobeSenseNovaAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const sensenova_1 = require("../../core/contextBuilders/sensenova");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
exports.params = {
    baseURL: 'https://api.sensenova.cn/compatible-mode/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { frequency_penalty, max_tokens, messages, model, temperature, thinking, top_p, ...rest } = payload;
            return {
                ...rest,
                frequency_penalty: frequency_penalty !== undefined && frequency_penalty > 0 && frequency_penalty <= 2
                    ? frequency_penalty
                    : undefined,
                max_new_tokens: max_tokens !== undefined && max_tokens > 0 ? max_tokens : undefined,
                messages: messages.map((message) => message.role !== 'user' || !model || !/^Sense(Nova-V6|Chat-Vision)/.test(model)
                    ? message
                    : { ...message, content: (0, sensenova_1.convertSenseNovaMessage)(message.content) }),
                model,
                stream: true,
                temperature: temperature !== undefined && temperature > 0 && temperature <= 2
                    ? temperature
                    : undefined,
                thinking: thinking
                    ? model && model.includes('-V6-5-') && thinking.type === 'enabled'
                        ? { enabled: true }
                        : { enabled: false }
                    : undefined,
                top_p: top_p !== undefined && top_p > 0 && top_p < 1 ? top_p : undefined,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_SENSENOVA_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const functionCallKeywords = ['1202'];
        const visionKeywords = ['vision', 'sensenova-v6'];
        const reasoningKeywords = ['deepseek-r1', 'reasoner'];
        client.baseURL = 'https://api.sensenova.cn/v1/llm';
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return modelList
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.id.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: knownModel?.contextWindowTokens ?? undefined,
                displayName: knownModel?.displayName ?? undefined,
                enabled: knownModel?.enabled || false,
                functionCall: functionCallKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)) ||
                    knownModel?.abilities?.functionCall ||
                    false,
                id: model.id,
                reasoning: reasoningKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)) ||
                    knownModel?.abilities?.reasoning ||
                    false,
                vision: visionKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)) ||
                    knownModel?.abilities?.vision ||
                    false,
            };
        })
            .filter(Boolean);
    },
    provider: model_bank_1.ModelProvider.SenseNova,
};
exports.LobeSenseNovaAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map