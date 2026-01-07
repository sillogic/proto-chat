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
exports.LobeGroq = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const parameterResolver_1 = require("../../core/parameterResolver");
const error_1 = require("../../types/error");
/**
 * Filter out advanced JSON Schema properties that Groq doesn't support
 */
const filterAdvancedFields = (schema) => {
    if (typeof schema !== 'object' || schema === null) {
        return schema;
    }
    if (Array.isArray(schema)) {
        return schema.map(filterAdvancedFields);
    }
    const filtered = {};
    // List of advanced properties to filter out
    const unsupportedProperties = new Set([
        'maxItems',
        'minItems',
        'maxLength',
        'minLength',
        'pattern',
        'format',
        'uniqueItems',
        'maxProperties',
        'minProperties',
        'multipleOf',
        'maximum',
        'minimum',
        'exclusiveMaximum',
        'exclusiveMinimum',
    ]);
    for (const [key, value] of Object.entries(schema)) {
        if (unsupportedProperties.has(key)) {
            continue;
        }
        filtered[key] = filterAdvancedFields(value);
    }
    return filtered;
};
exports.params = {
    baseURL: 'https://api.groq.com/openai/v1',
    chatCompletion: {
        handleError: (error) => {
            // 403 means the location is not supported
            if (error.status === 403)
                return { error, errorType: error_1.AgentRuntimeErrorType.LocationNotSupportError };
        },
        handlePayload: (payload) => {
            const { temperature, ...restPayload } = payload;
            // Groq doesn't support temperature <= 0, set to undefined in that case
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({ temperature }, { normalizeTemperature: false });
            return {
                ...restPayload,
                stream: payload.stream ?? true,
                temperature: resolvedParams.temperature !== undefined && resolvedParams.temperature <= 0
                    ? undefined
                    : resolvedParams.temperature,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_GROQ_CHAT_COMPLETION === '1',
    },
    generateObject: {
        handleSchema: filterAdvancedFields,
    },
    models: async ({ client }) => {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const functionCallKeywords = [
            'tool',
            'llama-3.3',
            'llama-3.1',
            'llama3-',
            'mixtral-8x7b-32768',
            'gemma2-9b-it',
        ];
        const reasoningKeywords = ['deepseek-r1'];
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return modelList
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.id.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: model.context_window,
                displayName: knownModel?.displayName ?? undefined,
                enabled: knownModel?.enabled || false,
                functionCall: functionCallKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)) ||
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
    provider: model_bank_1.ModelProvider.Groq,
};
exports.LobeGroq = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map