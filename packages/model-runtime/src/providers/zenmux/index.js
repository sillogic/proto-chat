"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeZenMuxAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const url_join_1 = __importDefault(require("url-join"));
const RouterRuntime_1 = require("../../core/RouterRuntime");
const modelParse_1 = require("../../utils/modelParse");
const DEFAULT_BASE_URL = 'https://zenmux.ai';
exports.params = {
    chatCompletion: {
        handlePayload: (payload) => {
            const { reasoning_effort, thinking, reasoning, ...rest } = payload;
            const finalReasoning = {
                ...reasoning,
                ...(reasoning_effort && { effort: reasoning_effort }),
                ...(thinking?.budget_tokens && { max_tokens: thinking.budget_tokens }),
                ...(thinking?.type === 'enabled' && { enabled: true }),
                ...(thinking?.type === 'disabled' && { enabled: false }),
            };
            const hasReasoning = Object.keys(finalReasoning).length > 0;
            return {
                ...rest,
                ...(hasReasoning && { reasoning: finalReasoning }),
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_ZENMUX_CHAT_COMPLETION === '1',
    },
    id: model_bank_1.ModelProvider.ZenMux,
    models: async ({ client: openAIClient }) => {
        const modelsPage = (await openAIClient.models.list());
        const modelList = modelsPage.data || [];
        return (0, modelParse_1.processMultiProviderModelList)(modelList, 'zenmux');
    },
    routers: (options) => {
        const baseURL = options.baseURL || DEFAULT_BASE_URL;
        const userBaseURL = baseURL.replace(/\/v\d+[a-z]*\/?$/, '').replace(/\/api\/?$/, '');
        return [
            {
                apiType: 'anthropic',
                models: model_bank_1.LOBE_DEFAULT_MODEL_LIST.map((m) => m.id).filter((id) => (0, modelParse_1.detectModelProvider)(id) === 'anthropic'),
                options: {
                    ...options,
                    baseURL: (0, url_join_1.default)(userBaseURL, '/api/anthropic'),
                },
            },
            {
                apiType: 'google',
                models: model_bank_1.LOBE_DEFAULT_MODEL_LIST.map((m) => m.id).filter((id) => (0, modelParse_1.detectModelProvider)(id) === 'google'),
                options: {
                    ...options,
                    baseURL: (0, url_join_1.default)(userBaseURL, '/api/vertex-ai'),
                },
            },
            {
                apiType: 'openai',
                options: {
                    ...options,
                    baseURL: (0, url_join_1.default)(userBaseURL, '/api/v1'),
                },
            },
        ];
    },
};
exports.LobeZenMuxAI = (0, RouterRuntime_1.createRouterRuntime)(exports.params);
//# sourceMappingURL=index.js.map