"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeVercelAIGatewayAI = exports.params = exports.formatPrice = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
const formatPrice = (price) => {
    if (price === undefined || price === null)
        return undefined;
    const n = typeof price === 'number' ? price : Number(price);
    if (Number.isNaN(n))
        return undefined;
    // Convert per-token price (USD) to per million tokens
    return Number((n * 1e6).toPrecision(5));
};
exports.formatPrice = formatPrice;
exports.params = {
    baseURL: 'https://ai-gateway.vercel.sh/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, reasoning_effort, verbosity, ...rest } = payload;
            const providerOptions = {};
            if (reasoning_effort || verbosity) {
                providerOptions.openai = {};
                if (reasoning_effort) {
                    providerOptions.openai.reasoningEffort = reasoning_effort;
                    providerOptions.openai.reasoningSummary = 'auto';
                }
                if (verbosity) {
                    providerOptions.openai.textVerbosity = verbosity;
                }
            }
            return {
                ...rest,
                model,
                providerOptions,
            };
        },
    },
    constructorOptions: {
        defaultHeaders: {
            'http-referer': 'https://lobehub.com',
            'x-title': 'LobeHub',
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_VERCELAIGATEWAY_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        const formattedModels = (modelList || []).map((m) => {
            const tags = Array.isArray(m.tags) ? m.tags : [];
            const inputPrice = (0, exports.formatPrice)(m.pricing?.input);
            const outputPrice = (0, exports.formatPrice)(m.pricing?.output);
            const cachedInputPrice = (0, exports.formatPrice)(m.pricing?.input_cache_read);
            const writeCacheInputPrice = (0, exports.formatPrice)(m.pricing?.input_cache_write);
            let displayName = m.name ?? m.id;
            if (inputPrice === 0 && outputPrice === 0) {
                displayName += ' (free)';
            }
            return {
                contextWindowTokens: m.context_window ?? undefined,
                created: m.created,
                description: m.description ?? '',
                displayName,
                functionCall: tags.includes('tool-use') || false,
                id: m.id,
                maxOutput: typeof m.max_tokens === 'number' ? m.max_tokens : undefined,
                pricing: {
                    cachedInput: cachedInputPrice,
                    input: inputPrice,
                    output: outputPrice,
                    writeCacheInput: writeCacheInputPrice,
                },
                reasoning: tags.includes('reasoning') || false,
                type: m.type === 'embedding' ? 'embedding' : 'chat',
                vision: tags.includes('vision') || false,
            };
        });
        return await (0, modelParse_1.processMultiProviderModelList)(formattedModels, 'vercelaigateway');
    },
    provider: model_bank_1.ModelProvider.VercelAIGateway,
};
exports.LobeVercelAIGatewayAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map