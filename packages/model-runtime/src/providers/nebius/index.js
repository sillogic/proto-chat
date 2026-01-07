"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeNebiusAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api.studio.nebius.com/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, ...rest } = payload;
            return {
                ...rest,
                model,
                stream: true,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_NEBIUS_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const base = client.baseURL || 'https://api.studio.nebius.com/v1';
        const url = `${base.replace(/\/+$/, '')}/models?verbose=true`;
        const res = await fetch(url, {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${client.apiKey}`,
            },
            method: 'GET',
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch Nebius models: ${res.status} ${res.statusText}`);
        }
        const body = (await res.json());
        const rawList = body?.data ?? [];
        const standardList = rawList.map((m) => {
            const modality = m.architecture?.modality;
            let inferredType = undefined;
            if (typeof modality === 'string' && modality.includes('->')) {
                const parts = modality.split('->');
                const right = parts[1]?.trim().toLowerCase();
                if (right === 'image') {
                    inferredType = 'image';
                }
                if (right === 'embedding') {
                    inferredType = 'embedding';
                }
            }
            return {
                contextWindowTokens: m.context_length ?? undefined,
                description: m.description ?? '',
                displayName: m.name ?? m.id,
                functionCall: m.features?.includes('function-calling'),
                id: m.id,
                pricing: {
                    input: m.pricing.prompt * 1000000,
                    output: m.pricing.completion * 1000000,
                },
                reasoning: m.features?.includes('reasoning'),
                type: inferredType,
                vision: m.features?.includes('vision'),
            };
        });
        return (0, modelParse_1.processMultiProviderModelList)(standardList, 'nebius');
    },
    provider: model_bank_1.ModelProvider.Nebius,
};
exports.LobeNebiusAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map