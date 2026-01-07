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
exports.LobeBedrockAI = void 0;
exports.experimental_buildLlama2Prompt = experimental_buildLlama2Prompt;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const model_bank_1 = require("model-bank");
const models_1 = require("../../const/models");
const anthropic_1 = require("../../core/contextBuilders/anthropic");
const parameterResolver_1 = require("../../core/parameterResolver");
const streams_1 = require("../../core/streams");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const debugStream_1 = require("../../utils/debugStream");
const getModelPricing_1 = require("../../utils/getModelPricing");
const response_1 = require("../../utils/response");
const resolveCacheTTL_1 = require("../anthropic/resolveCacheTTL");
const resolveMaxTokens_1 = require("../anthropic/resolveMaxTokens");
/**
 * A prompt constructor for HuggingFace LLama 2 chat models.
 * Does not support `function` messages.
 * @see https://huggingface.co/meta-llama/Llama-2-70b-chat-hf and https://huggingface.co/blog/llama2#how-to-prompt-llama-2
 */
function experimental_buildLlama2Prompt(messages) {
    const startPrompt = `<s>[INST] `;
    const endPrompt = ` [/INST]`;
    const conversation = messages.map(({ content, role }, index) => {
        switch (role) {
            case 'user': {
                return content.trim();
            }
            case 'assistant': {
                return ` [/INST] ${content}</s><s>[INST] `;
            }
            case 'function': {
                throw new Error('Llama 2 does not support function calls.');
            }
            default: {
                if (role === 'system' && index === 0) {
                    return `<<SYS>>\n${content}\n<</SYS>>\n\n`;
                }
                else {
                    throw new Error(`Invalid message role: ${role}`);
                }
            }
        }
    });
    return startPrompt + conversation.join('') + endPrompt;
}
class LobeBedrockAI {
    constructor(options = {}) {
        this.invokeEmbeddingModel = async (payload, options) => {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                accept: 'application/json',
                body: JSON.stringify({
                    dimensions: payload.dimensions,
                    inputText: payload.input,
                    normalize: true,
                }),
                contentType: 'application/json',
                modelId: payload.model,
            });
            try {
                const res = await this.client.send(command, { abortSignal: options?.signal });
                const responseBody = JSON.parse(new TextDecoder().decode(res.body));
                return responseBody.embedding;
            }
            catch (e) {
                const err = e;
                throw createError_1.AgentRuntimeError.chat({
                    error: {
                        body: err.$metadata,
                        message: err.message,
                        type: err.name,
                    },
                    errorType: error_1.AgentRuntimeErrorType.ProviderBizError,
                    provider: model_bank_1.ModelProvider.Bedrock,
                    region: this.region,
                });
            }
        };
        this.invokeClaudeModel = async (payload, options) => {
            const { enabledContextCaching = true, max_tokens, messages, model, temperature, top_p, tools, thinking, } = payload;
            const inputStartAt = Date.now();
            const system_message = messages.find((m) => m.role === 'system');
            const user_messages = messages.filter((m) => m.role !== 'system');
            // Resolve temperature and top_p parameters based on model constraints
            const hasConflict = (0, models_1.hasTemperatureTopPConflict)(model);
            const resolvedParams = (0, parameterResolver_1.resolveParameters)({ temperature, top_p }, { hasConflict, normalizeTemperature: true, preferTemperature: true });
            const { bedrock: bedrockModels } = await Promise.resolve().then(() => __importStar(require('model-bank')));
            const resolvedMaxTokens = await (0, resolveMaxTokens_1.resolveMaxTokens)({
                max_tokens,
                model,
                providerModels: bedrockModels,
                thinking,
            });
            const systemPrompts = !!system_message?.content
                ? [
                    {
                        cache_control: enabledContextCaching ? { type: 'ephemeral' } : undefined,
                        text: system_message.content,
                        type: 'text',
                    },
                ]
                : undefined;
            const postTools = (0, anthropic_1.buildAnthropicTools)(tools, {
                enabledContextCaching,
            });
            const anthropicBase = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: resolvedMaxTokens,
                messages: await (0, anthropic_1.buildAnthropicMessages)(user_messages, { enabledContextCaching }),
                system: systemPrompts,
                tools: postTools,
            };
            const anthropicPayload = thinking?.type === 'enabled'
                ? {
                    ...anthropicBase,
                    thinking: {
                        ...thinking,
                        // `max_tokens` must be greater than `budget_tokens`
                        budget_tokens: Math.max(1, Math.min(thinking.budget_tokens || 1024, resolvedMaxTokens - 1)),
                    },
                }
                : {
                    ...anthropicBase,
                    temperature: resolvedParams.temperature,
                    top_p: resolvedParams.top_p,
                };
            const command = new client_bedrock_runtime_1.InvokeModelWithResponseStreamCommand({
                accept: 'application/json',
                body: JSON.stringify(anthropicPayload),
                contentType: 'application/json',
                modelId: model,
            });
            try {
                // Ask Claude for a streaming chat completion given the prompt
                const res = await this.client.send(command, { abortSignal: options?.signal });
                const claudeStream = (0, streams_1.createBedrockStream)(res);
                const [prod, debug] = claudeStream.tee();
                if (process.env.DEBUG_BEDROCK_CHAT_COMPLETION === '1') {
                    (0, debugStream_1.debugStream)(debug).catch(console.error);
                }
                const pricing = await (0, getModelPricing_1.getModelPricing)(payload.model, this.id);
                const cacheTTL = (0, resolveCacheTTL_1.resolveCacheTTL)({ ...payload, enabledContextCaching }, anthropicPayload);
                const pricingOptions = cacheTTL ? { lookupParams: { ttl: cacheTTL } } : undefined;
                // Respond with the stream
                return (0, response_1.StreamingResponse)((0, streams_1.AWSBedrockClaudeStream)(prod, {
                    callbacks: options?.callback,
                    inputStartAt,
                    payload: { model, pricing, pricingOptions, provider: this.id },
                }), {
                    headers: options?.headers,
                });
            }
            catch (e) {
                const err = e;
                throw createError_1.AgentRuntimeError.chat({
                    error: {
                        body: err.$metadata,
                        message: err.message,
                        type: err.name,
                    },
                    errorType: error_1.AgentRuntimeErrorType.ProviderBizError,
                    provider: model_bank_1.ModelProvider.Bedrock,
                    region: this.region,
                });
            }
        };
        this.invokeLlamaModel = async (payload, options) => {
            const { max_tokens, messages, model } = payload;
            const command = new client_bedrock_runtime_1.InvokeModelWithResponseStreamCommand({
                accept: 'application/json',
                body: JSON.stringify({
                    max_gen_len: max_tokens || 400,
                    prompt: experimental_buildLlama2Prompt(messages),
                }),
                contentType: 'application/json',
                modelId: model,
            });
            try {
                // Ask Claude for a streaming chat completion given the prompt
                const res = await this.client.send(command);
                const stream = (0, streams_1.createBedrockStream)(res);
                const [prod, debug] = stream.tee();
                if (process.env.DEBUG_BEDROCK_CHAT_COMPLETION === '1') {
                    (0, debugStream_1.debugStream)(debug).catch(console.error);
                }
                // Respond with the stream
                return (0, response_1.StreamingResponse)((0, streams_1.AWSBedrockLlamaStream)(prod, options?.callback), {
                    headers: options?.headers,
                });
            }
            catch (e) {
                const err = e;
                throw createError_1.AgentRuntimeError.chat({
                    error: {
                        body: err.$metadata,
                        message: err.message,
                        region: this.region,
                        type: err.name,
                    },
                    errorType: error_1.AgentRuntimeErrorType.ProviderBizError,
                    provider: model_bank_1.ModelProvider.Bedrock,
                    region: this.region,
                });
            }
        };
        const { id, region, accessKeyId, accessKeySecret, sessionToken } = options;
        if (!(accessKeyId && accessKeySecret))
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidBedrockCredentials);
        this.region = region ?? 'us-east-1';
        this.id = id ?? model_bank_1.ModelProvider.Bedrock;
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: accessKeySecret,
                sessionToken: sessionToken,
            },
            region: this.region,
        });
    }
    async chat(payload, options) {
        if (payload.model.startsWith('meta'))
            return this.invokeLlamaModel(payload, options);
        return this.invokeClaudeModel(payload, options);
    }
    /**
     * Supports the Amazon Titan Text models series.
     * Cohere Embed models are not supported
     * because the current text size per request
     * exceeds the maximum 2048 characters limit
     * for a single request for this series of models.
     * [bedrock embed guide] https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-embed.html
     */
    async embeddings(payload, options) {
        const input = Array.isArray(payload.input) ? payload.input : [payload.input];
        const promises = input.map((inputText) => this.invokeEmbeddingModel({
            dimensions: payload.dimensions,
            input: inputText,
            model: payload.model,
        }, options));
        return Promise.all(promises);
    }
}
exports.LobeBedrockAI = LobeBedrockAI;
exports.default = LobeBedrockAI;
//# sourceMappingURL=index.js.map