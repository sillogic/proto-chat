"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeAiHubMixAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const url_join_1 = __importDefault(require("url-join"));
const models_1 = require("../../const/models");
const RouterRuntime_1 = require("../../core/RouterRuntime");
const modelParse_1 = require("../../utils/modelParse");
const baseURL = 'https://aihubmix.com';
exports.params = {
    debug: {
        chatCompletion: () => process.env.DEBUG_AIHUBMIX_CHAT_COMPLETION === '1',
    },
    defaultHeaders: {
        'APP-Code': 'LobeHub',
    },
    id: model_bank_1.ModelProvider.AiHubMix,
    models: async ({ client }) => {
        try {
            const modelsPage = (await client.models.list());
            const modelList = modelsPage.data || [];
            return await (0, modelParse_1.processMultiProviderModelList)(modelList, 'aihubmix');
        }
        catch (error) {
            console.warn('Failed to fetch AiHubMix models. Please ensure your AiHubMix API key is valid:', error);
            return [];
        }
    },
    routers: [
        {
            apiType: 'anthropic',
            models: model_bank_1.LOBE_DEFAULT_MODEL_LIST.map((m) => m.id).filter((id) => (0, modelParse_1.detectModelProvider)(id) === 'anthropic'),
            options: { baseURL },
        },
        {
            apiType: 'google',
            models: model_bank_1.LOBE_DEFAULT_MODEL_LIST.map((m) => m.id).filter((id) => (0, modelParse_1.detectModelProvider)(id) === 'google'),
            options: { baseURL: (0, url_join_1.default)(baseURL, '/gemini') },
        },
        {
            apiType: 'xai',
            models: model_bank_1.LOBE_DEFAULT_MODEL_LIST.map((m) => m.id).filter((id) => (0, modelParse_1.detectModelProvider)(id) === 'xai'),
            options: { baseURL: (0, url_join_1.default)(baseURL, '/v1') },
        },
        {
            apiType: 'deepseek',
            models: ['deepseek-chat', 'deepseek-reasoner'],
            options: { baseURL: (0, url_join_1.default)(baseURL, '/v1') },
        },
        {
            apiType: 'openai',
            options: {
                baseURL: (0, url_join_1.default)(baseURL, '/v1'),
                chatCompletion: {
                    useResponseModels: [...Array.from(models_1.responsesAPIModels), /gpt-\d(?!\d)/, /^o\d/],
                },
            },
        },
    ],
};
exports.LobeAiHubMixAI = (0, RouterRuntime_1.createRouterRuntime)(exports.params);
//# sourceMappingURL=index.js.map