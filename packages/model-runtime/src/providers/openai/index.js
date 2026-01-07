"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeOpenAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const models_1 = require("../../const/models");
const openai_1 = require("../../core/contextBuilders/openai");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
const prunePrefixes = ['o1', 'o3', 'o4', 'codex', 'computer-use', 'gpt-5'];
const oaiSearchContextSize = process.env.OPENAI_SEARCH_CONTEXT_SIZE; // low, medium, high
const enableServiceTierFlex = process.env.OPENAI_SERVICE_TIER_FLEX === '1';
const flexSupportedModels = ['gpt-5', 'o3', 'o4-mini']; // Flex 处理仅适用于这些模型
const supportsFlexTier = (model) => {
    // 排除 o3-mini，其不支持 Flex 处理
    if (model.startsWith('o3-mini')) {
        return false;
    }
    return flexSupportedModels.some((supportedModel) => model.startsWith(supportedModel));
};
exports.params = {
    baseURL: 'https://api.openai.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { enabledSearch, model, ...rest } = payload;
            if (models_1.responsesAPIModels.has(model) || enabledSearch) {
                return { ...rest, apiMode: 'responses', enabledSearch, model };
            }
            if (prunePrefixes.some((prefix) => model.startsWith(prefix))) {
                return (0, openai_1.pruneReasoningPayload)(payload);
            }
            if (model.includes('-search-')) {
                return {
                    ...rest,
                    frequency_penalty: undefined,
                    model,
                    presence_penalty: undefined,
                    stream: payload.stream ?? true,
                    temperature: undefined,
                    top_p: undefined,
                    ...(enableServiceTierFlex && supportsFlexTier(model) && { service_tier: 'flex' }),
                    ...(oaiSearchContextSize && {
                        web_search_options: {
                            search_context_size: oaiSearchContextSize,
                        },
                    }),
                };
            }
            return {
                ...rest,
                model,
                ...(enableServiceTierFlex && supportsFlexTier(model) && { service_tier: 'flex' }),
                stream: payload.stream ?? true,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_OPENAI_CHAT_COMPLETION === '1',
        responses: () => process.env.DEBUG_OPENAI_RESPONSES === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        // 自动检测模型提供商并选择相应配置
        return (0, modelParse_1.processMultiProviderModelList)(modelList, 'openai');
    },
    provider: model_bank_1.ModelProvider.OpenAI,
    responses: {
        handlePayload: (payload) => {
            const { enabledSearch, model, tools, verbosity, ...rest } = payload;
            const openaiTools = enabledSearch
                ? [
                    ...(tools || []),
                    {
                        type: 'web_search',
                        ...(oaiSearchContextSize && {
                            search_context_size: oaiSearchContextSize,
                        }),
                    },
                ]
                : tools;
            if (prunePrefixes.some((prefix) => model.startsWith(prefix))) {
                const reasoning = payload.reasoning
                    ? { ...payload.reasoning, summary: 'auto' }
                    : { summary: 'auto' };
                if (model.startsWith('gpt-5-pro')) {
                    reasoning.effort = 'high';
                }
                return (0, openai_1.pruneReasoningPayload)({
                    ...rest,
                    model,
                    reasoning,
                    ...(enableServiceTierFlex && supportsFlexTier(model) && { service_tier: 'flex' }),
                    stream: payload.stream ?? true,
                    tools: openaiTools,
                    // computer-use series must set truncation as auto
                    ...(model.startsWith('computer-use') && { truncation: 'auto' }),
                    text: verbosity ? { verbosity } : undefined,
                });
            }
            return {
                ...rest,
                model,
                ...(enableServiceTierFlex && supportsFlexTier(model) && { service_tier: 'flex' }),
                stream: payload.stream ?? true,
                tools: openaiTools,
            };
        },
    },
};
exports.LobeOpenAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map