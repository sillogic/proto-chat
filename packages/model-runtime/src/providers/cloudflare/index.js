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
exports.LobeCloudflareAI = void 0;
const model_bank_1 = require("model-bank");
const streams_1 = require("../../core/streams");
const cloudflare_1 = require("../../core/streams/cloudflare");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const debugStream_1 = require("../../utils/debugStream");
const response_1 = require("../../utils/response");
class LobeCloudflareAI {
    constructor({ apiKey, baseURLOrAccountID } = {}) {
        if (!baseURLOrAccountID) {
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey);
        }
        if (baseURLOrAccountID.startsWith('http')) {
            this.baseURL = baseURLOrAccountID.endsWith('/')
                ? baseURLOrAccountID
                : baseURLOrAccountID + '/';
            // Try get accountID from baseURL
            this.accountID = baseURLOrAccountID.replaceAll(/^.*\/([\dA-Fa-f]{32})\/.*$/g, '$1');
        }
        else {
            if (!apiKey) {
                throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey);
            }
            this.accountID = baseURLOrAccountID;
            this.baseURL = (0, cloudflare_1.fillUrl)(baseURLOrAccountID);
        }
        this.apiKey = apiKey;
    }
    async chat(payload, options) {
        try {
            // Remove internal apiMode parameter to prevent sending to Cloudflare API
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { model, tools, apiMode: _, ...restPayload } = payload;
            const functions = tools?.map((tool) => tool.function);
            const headers = options?.headers || {};
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }
            const url = new URL(model, this.baseURL);
            const response = await fetch(url, {
                body: JSON.stringify({ tools: functions, ...restPayload }),
                headers: { 'Content-Type': 'application/json', ...headers },
                method: 'POST',
                signal: options?.signal,
            });
            const desensitizedEndpoint = (0, cloudflare_1.desensitizeCloudflareUrl)(url.toString());
            switch (response.status) {
                case 400: {
                    throw createError_1.AgentRuntimeError.chat({
                        endpoint: desensitizedEndpoint,
                        error: response,
                        errorType: error_1.AgentRuntimeErrorType.ProviderBizError,
                        provider: model_bank_1.ModelProvider.Cloudflare,
                    });
                }
            }
            // Only tee when debugging
            let responseBody;
            if (process.env.DEBUG_CLOUDFLARE_CHAT_COMPLETION === '1') {
                const [prod, useForDebug] = response.body.tee();
                (0, debugStream_1.debugStream)(useForDebug).catch();
                responseBody = prod;
            }
            else {
                responseBody = response.body;
            }
            return (0, response_1.StreamingResponse)(responseBody
                .pipeThrough(new TransformStream(new cloudflare_1.CloudflareStreamTransformer()))
                .pipeThrough((0, streams_1.createCallbacksTransformer)(options?.callback)), { headers: options?.headers });
        }
        catch (error) {
            const desensitizedEndpoint = (0, cloudflare_1.desensitizeCloudflareUrl)(this.baseURL);
            throw createError_1.AgentRuntimeError.chat({
                endpoint: desensitizedEndpoint,
                error: error,
                errorType: error_1.AgentRuntimeErrorType.ProviderBizError,
                provider: model_bank_1.ModelProvider.Cloudflare,
            });
        }
    }
    async models() {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const url = `${cloudflare_1.DEFAULT_BASE_URL_PREFIX}/client/v4/accounts/${this.accountID}/ai/models/search`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            method: 'GET',
        });
        const json = await response.json();
        const modelList = json.result;
        return modelList
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.name.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: model.properties?.max_total_tokens
                    ? Number(model.properties.max_total_tokens)
                    : (knownModel?.contextWindowTokens ?? undefined),
                displayName: knownModel?.displayName ??
                    (model.properties?.['beta'] === 'true' ? `${model.name} (Beta)` : undefined),
                enabled: knownModel?.enabled || false,
                functionCall: model.description.toLowerCase().includes('function call') ||
                    model.properties?.['function_calling'] === 'true' ||
                    knownModel?.abilities?.functionCall ||
                    false,
                id: model.name,
                reasoning: model.name.toLowerCase().includes('deepseek-r1') ||
                    knownModel?.abilities?.reasoning ||
                    false,
                vision: model.name.toLowerCase().includes('vision') ||
                    model.task?.name.toLowerCase().includes('image-to-text') ||
                    model.description.toLowerCase().includes('vision') ||
                    knownModel?.abilities?.vision ||
                    false,
            };
        })
            .filter(Boolean);
    }
}
exports.LobeCloudflareAI = LobeCloudflareAI;
//# sourceMappingURL=index.js.map