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
exports.LobeBaichuanAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
exports.params = {
    baseURL: 'https://api.baichuan-ai.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { enabledSearch, temperature, tools, ...rest } = payload;
            const baichuanTools = enabledSearch
                ? [
                    ...(tools || []),
                    {
                        type: 'web_search',
                        web_search: {
                            enable: true,
                            search_mode: process.env.BAICHUAN_SEARCH_MODE || 'performance_first', // performance_first or quality_first
                        },
                    },
                ]
                : tools;
            // Resolve parameters with normalization
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({ temperature }, { normalizeTemperature: true });
            return {
                ...rest,
                temperature: resolvedParams.temperature,
                tools: baichuanTools,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_BAICHUAN_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return modelList.filter(Boolean).map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.model.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: model.max_input_length,
                displayName: model.model_show_name,
                enabled: knownModel?.enabled || false,
                functionCall: model.function_call,
                id: model.model,
                maxOutput: model.max_tokens,
                reasoning: knownModel?.abilities?.reasoning || false,
                vision: knownModel?.abilities?.vision || false,
            };
        });
    },
    provider: model_bank_1.ModelProvider.Baichuan,
};
exports.LobeBaichuanAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map