"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeNovitaAI = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
const formatPrice = (price) => {
    if (price === undefined || price === null)
        return undefined;
    // Convert Novita price to desired unit: e.g. 5700 -> 0.57
    if (typeof price !== 'number')
        return undefined;
    if (price === -1)
        return undefined;
    return Number((price / 10000).toPrecision(5));
};
exports.LobeNovitaAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://api.novita.ai/v3/openai',
    constructorOptions: {
        defaultHeaders: {
            'X-Novita-Source': 'lobechat',
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_NOVITA_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        const formattedModels = modelList.map((m) => {
            const mm = m;
            const features = Array.isArray(mm.features) ? mm.features : [];
            const inputModalities = Array.isArray(mm.input_modalities) ? mm.input_modalities : [];
            return {
                contextWindowTokens: mm.context_size ?? mm.max_output_tokens ?? undefined,
                created: mm.created,
                description: mm.description ?? '',
                displayName: mm.display_name ?? mm.title ?? mm.id,
                functionCall: features.includes('function-calling') || false,
                id: mm.id,
                maxOutput: typeof mm.max_output_tokens === 'number' ? mm.max_output_tokens : undefined,
                pricing: {
                    input: formatPrice(mm.input_token_price_per_m),
                    output: formatPrice(mm.output_token_price_per_m),
                },
                reasoning: features.includes('reasoning') || false,
                type: mm.model_type ?? undefined,
                vision: inputModalities.includes('image') || features.includes('vision') || false,
            };
        });
        return await (0, modelParse_1.processMultiProviderModelList)(formattedModels, 'novita');
    },
    provider: model_bank_1.ModelProvider.Novita,
});
//# sourceMappingURL=index.js.map