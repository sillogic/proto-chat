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
exports.LobeHunyuanAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
exports.params = {
    baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
            const { enabledSearch, frequency_penalty, model, presence_penalty, thinking, ...rest } = payload;
            return {
                ...rest,
                frequency_penalty: undefined,
                model,
                presence_penalty: undefined,
                stream: true,
                ...(enabledSearch && {
                    citation: true,
                    enable_enhancement: true,
                    /*
                    enable_multimedia: true,
                    */
                    enable_speed_search: process.env.HUNYUAN_ENABLE_SPEED_SEARCH === '1',
                    search_info: true,
                }),
                ...(model === 'hunyuan-a13b' && {
                    enable_thinking: thinking?.type === 'enabled' ? true : thinking?.type === 'disabled' ? false : undefined,
                }),
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_HUNYUAN_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const functionCallKeywords = ['hunyuan-functioncall', 'hunyuan-turbo', 'hunyuan-pro'];
        const reasoningKeywords = ['hunyuan-t1'];
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return modelList
            .filter(Boolean)
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.id.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: knownModel?.contextWindowTokens ?? undefined,
                displayName: knownModel?.displayName ?? undefined,
                enabled: knownModel?.enabled || false,
                functionCall: (functionCallKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)) &&
                    !model.id.toLowerCase().includes('vision')) ||
                    knownModel?.abilities?.functionCall ||
                    false,
                id: model.id,
                reasoning: reasoningKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)) ||
                    knownModel?.abilities?.reasoning ||
                    false,
                vision: model.id.toLowerCase().includes('vision') || knownModel?.abilities?.vision || false,
            };
        })
            .filter(Boolean);
    },
    provider: model_bank_1.ModelProvider.Hunyuan,
};
exports.LobeHunyuanAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map