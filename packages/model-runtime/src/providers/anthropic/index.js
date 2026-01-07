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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeAnthropicAI = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const model_bank_1 = require("model-bank");
const models_1 = require("../../const/models");
const anthropic_1 = require("../../core/contextBuilders/anthropic");
const parameterResolver_1 = require("../../core/parameterResolver");
const streams_1 = require("../../core/streams");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const debugStream_1 = require("../../utils/debugStream");
const desensitizeUrl_1 = require("../../utils/desensitizeUrl");
const getModelPricing_1 = require("../../utils/getModelPricing");
const modelParse_1 = require("../../utils/modelParse");
const response_1 = require("../../utils/response");
const generateObject_1 = require("./generateObject");
const handleAnthropicError_1 = require("./handleAnthropicError");
const resolveCacheTTL_1 = require("./resolveCacheTTL");
const resolveMaxTokens_1 = require("./resolveMaxTokens");
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
class LobeAnthropicAI {
    isDebug() {
        return process.env.DEBUG_ANTHROPIC_CHAT_COMPLETION === '1';
    }
    constructor({ apiKey, baseURL = DEFAULT_BASE_URL, id, defaultHeaders, ...res } = {}) {
        if (!apiKey)
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey);
        const betaHeaders = process.env.ANTHROPIC_BETA_HEADERS;
        this.client = new sdk_1.default({
            apiKey,
            baseURL,
            defaultHeaders: { ...defaultHeaders, 'anthropic-beta': betaHeaders },
            ...res,
        });
        this.baseURL = this.client.baseURL;
        this.apiKey = apiKey;
        this.id = id || model_bank_1.ModelProvider.Anthropic;
    }
    async chat(payload, options) {
        try {
            const anthropicPayload = await this.buildAnthropicPayload(payload);
            const inputStartAt = Date.now();
            if (this.isDebug()) {
                console.log('[requestPayload]');
                console.log(JSON.stringify(anthropicPayload), '\n');
            }
            const response = await this.client.messages.create({
                ...anthropicPayload,
                metadata: options?.user ? { user_id: options?.user } : undefined,
                stream: true,
            }, {
                signal: options?.signal,
            });
            const [prod, debug] = response.tee();
            if (this.isDebug()) {
                (0, debugStream_1.debugStream)(debug.toReadableStream()).catch(console.error);
            }
            const pricing = await (0, getModelPricing_1.getModelPricing)(payload.model, this.id);
            const cacheTTL = (0, resolveCacheTTL_1.resolveCacheTTL)(payload, anthropicPayload);
            const pricingOptions = cacheTTL ? { lookupParams: { ttl: cacheTTL } } : undefined;
            return (0, response_1.StreamingResponse)((0, streams_1.AnthropicStream)(prod, {
                callbacks: options?.callback,
                inputStartAt,
                payload: { model: payload.model, pricing, pricingOptions, provider: this.id },
            }), {
                headers: options?.headers,
            });
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async generateObject(payload, options) {
        try {
            return await (0, generateObject_1.createAnthropicGenerateObject)(this.client, payload, options);
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async buildAnthropicPayload(payload) {
        const { messages, model, max_tokens, temperature, top_p, tools, thinking, enabledContextCaching = true, enabledSearch, } = payload;
        const { anthropic: anthropicModels } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const resolvedMaxTokens = await (0, resolveMaxTokens_1.resolveMaxTokens)({
            max_tokens,
            model,
            providerModels: anthropicModels,
            thinking,
        });
        const system_message = messages.find((m) => m.role === 'system');
        const user_messages = messages.filter((m) => m.role !== 'system');
        const systemPrompts = !!system_message?.content
            ? [
                {
                    cache_control: enabledContextCaching ? { type: 'ephemeral' } : undefined,
                    text: system_message?.content,
                    type: 'text',
                },
            ]
            : undefined;
        const postMessages = await (0, anthropic_1.buildAnthropicMessages)(user_messages, { enabledContextCaching });
        let postTools = (0, anthropic_1.buildAnthropicTools)(tools, {
            enabledContextCaching,
        });
        if (enabledSearch) {
            const webSearchTool = (0, anthropic_1.buildSearchTool)();
            if (postTools && postTools.length > 0) {
                postTools = [...postTools, webSearchTool];
            }
            else {
                postTools = [webSearchTool];
            }
        }
        if (!!thinking && thinking.type === 'enabled') {
            // `temperature` may only be set to 1 when thinking is enabled.
            // `top_p` must be unset when thinking is enabled.
            return {
                max_tokens: resolvedMaxTokens,
                messages: postMessages,
                model,
                system: systemPrompts,
                thinking: {
                    ...thinking,
                    budget_tokens: thinking?.budget_tokens
                        ? Math.min(thinking.budget_tokens, resolvedMaxTokens - 1) // `max_tokens` must be greater than `thinking.budget_tokens`.
                        : 1024,
                },
                tools: postTools,
            };
        }
        // Resolve temperature and top_p parameters based on model constraints
        const hasConflict = (0, models_1.hasTemperatureTopPConflict)(model);
        const resolvedParams = (0, parameterResolver_1.resolveParameters)({ temperature, top_p }, { hasConflict, normalizeTemperature: true, preferTemperature: true });
        return {
            // claude 3 series model hax max output token of 4096, 3.x series has 8192
            // https://docs.anthropic.com/en/docs/about-claude/models/all-models#:~:text=200K-,Max%20output,-Normal%3A
            max_tokens: resolvedMaxTokens,
            messages: postMessages,
            model,
            system: systemPrompts,
            temperature: resolvedParams.temperature,
            tools: postTools,
            top_p: resolvedParams.top_p,
        };
    }
    async models() {
        const url = `${this.baseURL}/v1/models`;
        const response = await fetch(url, {
            headers: {
                'anthropic-version': '2023-06-01',
                'x-api-key': `${this.apiKey}`,
            },
            method: 'GET',
        });
        const json = await response.json();
        const modelList = json['data'];
        const standardModelList = modelList.map((model) => ({
            created: model.created_at,
            displayName: model.display_name,
            id: model.id,
        }));
        return (0, modelParse_1.processModelList)(standardModelList, modelParse_1.MODEL_LIST_CONFIGS.anthropic, 'anthropic');
    }
    handleError(error) {
        let desensitizedEndpoint = this.baseURL;
        if (this.baseURL !== DEFAULT_BASE_URL) {
            desensitizedEndpoint = (0, desensitizeUrl_1.desensitizeUrl)(this.baseURL);
        }
        if ('status' in error) {
            switch (error.status) {
                case 401: {
                    throw createError_1.AgentRuntimeError.chat({
                        endpoint: desensitizedEndpoint,
                        error: error,
                        errorType: error_1.AgentRuntimeErrorType.InvalidProviderAPIKey,
                        provider: this.id,
                    });
                }
                case 403: {
                    throw createError_1.AgentRuntimeError.chat({
                        endpoint: desensitizedEndpoint,
                        error: error,
                        errorType: error_1.AgentRuntimeErrorType.LocationNotSupportError,
                        provider: this.id,
                    });
                }
                default: {
                    break;
                }
            }
        }
        const { errorResult } = (0, handleAnthropicError_1.handleAnthropicError)(error);
        throw createError_1.AgentRuntimeError.chat({
            endpoint: desensitizedEndpoint,
            error: errorResult,
            errorType: error_1.AgentRuntimeErrorType.ProviderBizError,
            provider: this.id,
        });
    }
}
exports.LobeAnthropicAI = LobeAnthropicAI;
exports.default = LobeAnthropicAI;
//# sourceMappingURL=index.js.map