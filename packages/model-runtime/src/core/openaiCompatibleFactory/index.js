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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpenAICompatibleRuntime = exports.CHAT_MODELS_BLOCK_LIST = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const debug_1 = __importDefault(require("debug"));
const model_bank_1 = require("model-bank");
const openai_1 = __importDefault(require("openai"));
const models_1 = require("../../const/models");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const debugStream_1 = require("../../utils/debugStream");
const desensitizeUrl_1 = require("../../utils/desensitizeUrl");
const getFallbackModelProperty_1 = require("../../utils/getFallbackModelProperty");
const getModelPricing_1 = require("../../utils/getModelPricing");
const handleOpenAIError_1 = require("../../utils/handleOpenAIError");
const postProcessModelList_1 = require("../../utils/postProcessModelList");
const response_1 = require("../../utils/response");
const openai_2 = require("../contextBuilders/openai");
const streams_1 = require("../streams");
const createImage_1 = require("./createImage");
const nonStreamToStream_1 = require("./nonStreamToStream");
__exportStar(require("./nonStreamToStream"), exports);
// the model contains the following keywords is not a chat model, so we should filter them out
exports.CHAT_MODELS_BLOCK_LIST = [
    'embedding',
    'davinci',
    'curie',
    'moderation',
    'ada',
    'babbage',
    'tts',
    'whisper',
    'dall-e',
];
const createOpenAICompatibleRuntime = ({ provider, baseURL: DEFAULT_BASE_URL, apiKey: DEFAULT_API_KEY, errorType, debug: debugParams, constructorOptions, chatCompletion, models, customClient, responses, createImage: customCreateImage, generateObject: generateObjectConfig, }) => {
    const ErrorType = {
        bizError: errorType?.bizError || error_1.AgentRuntimeErrorType.ProviderBizError,
        invalidAPIKey: errorType?.invalidAPIKey || error_1.AgentRuntimeErrorType.InvalidProviderAPIKey,
    };
    return class LobeOpenAICompatibleAI {
        constructor(options = {}) {
            this.convertChatCompletionToolToResponseTool = (tool) => {
                return { type: tool.type, ...tool.function };
            };
            const _options = {
                ...options,
                apiKey: options.apiKey?.trim() || DEFAULT_API_KEY,
                baseURL: options.baseURL?.trim() || DEFAULT_BASE_URL,
            };
            const { apiKey, baseURL = DEFAULT_BASE_URL, ...res } = _options;
            this._options = _options;
            if (!apiKey)
                throw createError_1.AgentRuntimeError.createError(ErrorType?.invalidAPIKey);
            const initOptions = { apiKey, baseURL, ...constructorOptions, ...res };
            // if the custom client is provided, use it as client
            if (customClient?.createClient) {
                this.client = customClient.createClient(initOptions);
            }
            else {
                this.client = new openai_1.default(initOptions);
            }
            this.baseURL = baseURL || this.client.baseURL;
            this.id = options.id || provider;
            this.logPrefix = `lobe-model-runtime:${this.id}`;
        }
        /**
         * Determine if should use Responses API based on various configuration options
         * @param params - Configuration parameters
         * @returns true if should use Responses API, false otherwise
         */
        shouldUseResponsesAPI(params) {
            const { model, userApiMode, responseApi, flagUseResponse, flagUseResponseModels, context = 'operation', } = params;
            const log = (0, debug_1.default)(`${this.logPrefix}:shouldUseResponsesAPI`);
            // Priority 0: Check built-in responsesAPIModels FIRST (highest priority)
            // These models MUST use Responses API regardless of user settings
            if (model && models_1.responsesAPIModels.has(model)) {
                log('using Responses API: model %s in built-in responsesAPIModels (forced)', model);
                return true;
            }
            // Priority 1: userApiMode is explicitly set to 'chatCompletion' (user disabled the switch)
            if (userApiMode === 'chatCompletion') {
                log('using Chat Completions API: userApiMode=%s', userApiMode);
                return false;
            }
            // Priority 2: When user enables the switch (userApiMode === 'responses')
            // Check if useResponseModels is configured - if so, only matching models use Responses API
            // If useResponseModels is not configured, all models use Responses API
            if (userApiMode === 'responses') {
                if (model && flagUseResponseModels?.length) {
                    const matches = flagUseResponseModels.some((m) => typeof m === 'string' ? model.includes(m) : m.test(model));
                    if (matches) {
                        log('using Responses API: userApiMode=responses and model %s matches useResponseModels', model);
                        return true;
                    }
                    log('using Chat Completions API: userApiMode=responses but model %s does not match useResponseModels', model);
                    return false;
                }
                // No useResponseModels configured, use Responses API for all models
                log('using Responses API: userApiMode=responses (no useResponseModels filter)');
                return true;
            }
            // Priority 3: Explicit responseApi flag
            if (responseApi) {
                log('using Responses API: explicit responseApi flag for %s', context);
                return true;
            }
            // Priority 4: Factory/instance level useResponse flag
            if (flagUseResponse) {
                log('using Responses API: flagUseResponse=true for %s', context);
                return true;
            }
            // Priority 5: Check if model matches useResponseModels patterns (without user switch)
            if (model && flagUseResponseModels?.length) {
                const matches = flagUseResponseModels.some((m) => typeof m === 'string' ? model.includes(m) : m.test(model));
                if (matches) {
                    log('using Responses API: model %s matches useResponseModels config', model);
                    return true;
                }
            }
            log('using Chat Completions API for %s', context);
            return false;
        }
        async chat({ responseMode, ...payload }, options) {
            try {
                const log = (0, debug_1.default)(`${this.logPrefix}:chat`);
                const inputStartAt = Date.now();
                log('chat called with model: %s, stream: %s', payload.model, payload.stream ?? true);
                let processedPayload = payload;
                const userApiMode = payload.apiMode;
                const modelId = payload.model;
                const instanceChat = (this._options.chatCompletion || {});
                const flagUseResponse = instanceChat.useResponse ?? (chatCompletion ? chatCompletion.useResponse : undefined);
                const flagUseResponseModels = instanceChat.useResponseModels ?? chatCompletion?.useResponseModels;
                // Determine if should use Responses API
                const shouldUseResponses = this.shouldUseResponsesAPI({
                    context: 'chat',
                    flagUseResponse,
                    flagUseResponseModels,
                    model: modelId,
                    userApiMode,
                });
                if (shouldUseResponses) {
                    processedPayload = { ...payload, apiMode: 'responses' };
                }
                // 再进行工厂级处理
                const postPayload = chatCompletion?.handlePayload
                    ? chatCompletion.handlePayload(processedPayload, this._options)
                    : {
                        ...processedPayload,
                        stream: processedPayload.stream ?? true,
                    };
                if (postPayload.apiMode === 'responses') {
                    return this.handleResponseAPIMode(processedPayload, options);
                }
                const computedBaseURL = typeof this._options.baseURL === 'string' && this._options.baseURL
                    ? this._options.baseURL.trim()
                    : typeof DEFAULT_BASE_URL === 'string'
                        ? DEFAULT_BASE_URL
                        : undefined;
                const targetBaseURL = computedBaseURL || this.baseURL;
                if (targetBaseURL !== this.baseURL) {
                    const restOptions = {
                        ...this._options,
                    };
                    const optionApiKey = restOptions.apiKey;
                    delete restOptions.apiKey;
                    delete restOptions.baseURL;
                    const sanitizedApiKey = optionApiKey?.toString().trim() || DEFAULT_API_KEY;
                    const nextOptions = {
                        ...restOptions,
                        apiKey: sanitizedApiKey,
                        baseURL: targetBaseURL,
                    };
                    const initOptions = {
                        apiKey: sanitizedApiKey,
                        baseURL: targetBaseURL,
                        ...constructorOptions,
                        ...restOptions,
                    };
                    this._options = nextOptions;
                    if (customClient?.createClient) {
                        this.client = customClient.createClient(initOptions);
                    }
                    else {
                        this.client = new openai_1.default(initOptions);
                    }
                    this.baseURL = targetBaseURL;
                }
                const messages = await (0, openai_2.convertOpenAIMessages)(postPayload.messages);
                let response;
                const streamOptions = {
                    bizErrorTypeTransformer: chatCompletion?.handleStreamBizErrorType,
                    callbacks: options?.callback,
                    payload: {
                        model: payload.model,
                        pricing: await (0, getModelPricing_1.getModelPricing)(payload.model, this.id),
                        provider: this.id,
                    },
                };
                if (customClient?.createChatCompletionStream) {
                    log('using custom client for chat completion stream');
                    response = customClient.createChatCompletionStream(this.client, processedPayload, this);
                }
                else {
                    // Remove internal apiMode parameter before sending to API
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { apiMode: _, ...cleanedPayload } = postPayload;
                    const finalPayload = {
                        ...cleanedPayload,
                        messages,
                        ...(chatCompletion?.noUserId ? {} : { user: options?.user }),
                        stream_options: postPayload.stream && !chatCompletion?.excludeUsage
                            ? { include_usage: true }
                            : undefined,
                    };
                    log('sending chat completion request with %d messages', messages.length);
                    if (debugParams?.chatCompletion?.()) {
                        console.log('[requestPayload]');
                        console.log(JSON.stringify(finalPayload), '\n');
                    }
                    response = (await this.client.chat.completions.create(finalPayload, {
                        // https://github.com/lobehub/lobe-chat/pull/318
                        headers: { Accept: '*/*', ...options?.requestHeaders },
                        signal: options?.signal,
                    }));
                }
                if (postPayload.stream) {
                    log('processing streaming response');
                    const [prod, useForDebug] = response.tee();
                    if (debugParams?.chatCompletion?.()) {
                        const useForDebugStream = useForDebug instanceof ReadableStream ? useForDebug : useForDebug.toReadableStream();
                        (0, debugStream_1.debugStream)(useForDebugStream).catch(console.error);
                    }
                    return (0, response_1.StreamingResponse)(chatCompletion?.handleStream
                        ? chatCompletion.handleStream(prod, {
                            callbacks: streamOptions.callbacks,
                            inputStartAt,
                        })
                        : (0, streams_1.OpenAIStream)(prod, {
                            ...streamOptions,
                            inputStartAt,
                        }), {
                        headers: options?.headers,
                    });
                }
                if (debugParams?.chatCompletion?.()) {
                    (0, debugStream_1.debugResponse)(response);
                }
                if (responseMode === 'json') {
                    log('returning JSON response mode');
                    return Response.json(response);
                }
                log('transforming non-streaming response to stream');
                const transformHandler = chatCompletion?.handleTransformResponseToStream || nonStreamToStream_1.transformResponseToStream;
                const stream = transformHandler(response);
                return (0, response_1.StreamingResponse)(chatCompletion?.handleStream
                    ? chatCompletion.handleStream(stream, {
                        callbacks: streamOptions.callbacks,
                        inputStartAt,
                    })
                    : (0, streams_1.OpenAIStream)(stream, { ...streamOptions, enableStreaming: false, inputStartAt }), {
                    headers: options?.headers,
                });
            }
            catch (error) {
                throw this.handleError(error);
            }
        }
        async createImage(payload) {
            const log = (0, debug_1.default)(`${this.logPrefix}:createImage`);
            // If custom createImage implementation is provided, use it
            if (customCreateImage) {
                log('using custom createImage implementation');
                return customCreateImage(payload, {
                    ...this._options,
                    apiKey: this._options.apiKey,
                    provider,
                });
            }
            log('using default createOpenAICompatibleImage');
            // Use the new createOpenAICompatibleImage function
            return (0, createImage_1.createOpenAICompatibleImage)(this.client, payload, this.id);
        }
        async models() {
            const log = (0, debug_1.default)(`${this.logPrefix}:models`);
            log('fetching available models');
            let resultModels = [];
            if (typeof models === 'function') {
                log('using custom models function');
                resultModels = await models({ client: this.client });
            }
            else {
                log('fetching models from client API');
                const list = await this.client.models.list();
                resultModels = list.data
                    .filter((model) => {
                    return exports.CHAT_MODELS_BLOCK_LIST.every((keyword) => !model.id.toLowerCase().includes(keyword));
                })
                    .map((item) => {
                    if (models?.transformModel) {
                        return models.transformModel(item);
                    }
                    const toReleasedAt = () => {
                        if (!item.created)
                            return;
                        dayjs_1.default.extend(utc_1.default);
                        // guarantee item.created in Date String format
                        if (typeof item.created === 'string' ||
                            // or in milliseconds
                            item.created.toFixed(0).length === 13) {
                            return dayjs_1.default.utc(item.created).format('YYYY-MM-DD');
                        }
                        // by default, the created time is in seconds
                        return dayjs_1.default.utc(item.created * 1000).format('YYYY-MM-DD');
                    };
                    // TODO: should refactor after remove v1 user/modelList code
                    const knownModel = model_bank_1.LOBE_DEFAULT_MODEL_LIST.find((model) => model.id === item.id);
                    if (knownModel) {
                        const releasedAt = knownModel.releasedAt ?? toReleasedAt();
                        return { ...knownModel, releasedAt };
                    }
                    return {
                        id: item.id,
                        releasedAt: toReleasedAt(),
                    };
                })
                    .filter(Boolean);
            }
            log('fetched %d models', resultModels.length);
            return await (0, postProcessModelList_1.postProcessModelList)(resultModels, (modelId) => (0, getFallbackModelProperty_1.getModelPropertyWithFallback)(modelId, 'type'));
        }
        async generateObject(payload, options) {
            const { messages, schema, model, responseApi, tools } = payload;
            const log = (0, debug_1.default)(`${this.logPrefix}:generateObject`);
            log('generateObject called with model: %s, hasTools: %s, hasSchema: %s', model, !!tools, !!schema);
            if (tools) {
                log('using tools-based generation');
                return this.generateObjectWithTools(payload, options);
            }
            if (!schema)
                throw new Error('tools or schema is required');
            // Use tool calling fallback if configured
            if (generateObjectConfig?.useToolsCalling) {
                log('using tool calling fallback for structured output');
                // Apply schema transformation if configured
                const processedSchema = generateObjectConfig.handleSchema
                    ? { ...schema, schema: generateObjectConfig.handleSchema(schema.schema) }
                    : schema;
                const tool = {
                    function: {
                        description: processedSchema.description ||
                            'Generate structured output according to the provided schema',
                        name: processedSchema.name || 'structured_output',
                        parameters: processedSchema.schema,
                    },
                    type: 'function',
                };
                const res = await this.client.chat.completions.create({
                    messages,
                    model,
                    tool_choice: { function: { name: tool.function.name }, type: 'function' },
                    tools: [tool],
                    user: options?.user,
                }, { headers: options?.headers, signal: options?.signal });
                const toolCalls = res.choices[0].message.tool_calls;
                try {
                    return toolCalls.map((item) => ({
                        arguments: JSON.parse(item.function.arguments),
                        name: item.function.name,
                    }));
                }
                catch {
                    console.error('parse tool call arguments error:', toolCalls);
                    return undefined;
                }
            }
            // Factory-level Responses API routing control (supports instance override)
            const instanceGenerateObject = (this._options.generateObject || {});
            const flagUseResponse = instanceGenerateObject.useResponse ??
                (generateObjectConfig ? generateObjectConfig.useResponse : undefined);
            const flagUseResponseModels = instanceGenerateObject.useResponseModels ?? generateObjectConfig?.useResponseModels;
            const shouldUseResponses = this.shouldUseResponsesAPI({
                context: 'generateObject',
                flagUseResponse,
                flagUseResponseModels,
                model,
                responseApi,
            });
            // Apply schema transformation if configured
            const processedSchema = generateObjectConfig?.handleSchema
                ? { ...schema, schema: generateObjectConfig.handleSchema(schema.schema) }
                : schema;
            if (shouldUseResponses) {
                log('calling responses.create for structured output');
                const res = await this.client.responses.create({
                    input: messages,
                    model,
                    text: { format: { strict: true, type: 'json_schema', ...processedSchema } },
                    user: options?.user,
                }, { headers: options?.headers, signal: options?.signal });
                const text = res.output_text;
                log('received structured output from Responses API, length: %d', text?.length || 0);
                try {
                    const result = JSON.parse(text);
                    log('successfully parsed JSON output');
                    return result;
                }
                catch (error) {
                    log('failed to parse JSON output: %O', error);
                    console.error('parse json error:', text);
                    return undefined;
                }
            }
            log('calling chat.completions.create for structured output');
            const res = await this.client.chat.completions.create({
                messages,
                model,
                response_format: { json_schema: processedSchema, type: 'json_schema' },
                user: options?.user,
            }, { headers: options?.headers, signal: options?.signal });
            const text = res.choices[0].message.content;
            log('received structured output from Chat Completions API, length: %d', text?.length || 0);
            try {
                const result = JSON.parse(text);
                log('successfully parsed JSON output');
                return result;
            }
            catch (error) {
                log('failed to parse JSON output: %O', error);
                console.error('parse json error:', text);
                return undefined;
            }
        }
        async embeddings(payload, options) {
            const log = (0, debug_1.default)(`${this.logPrefix}:embeddings`);
            log('embeddings called with model: %s, input items: %d', payload.model, Array.isArray(payload.input) ? payload.input.length : 1);
            try {
                const res = await this.client.embeddings.create({ ...payload, encoding_format: 'float', user: options?.user }, { headers: options?.headers, signal: options?.signal });
                log('received %d embeddings', res.data.length);
                return res.data.map((item) => item.embedding);
            }
            catch (error) {
                throw this.handleError(error);
            }
        }
        async textToImage(payload) {
            const log = (0, debug_1.default)(`${this.logPrefix}:textToImage`);
            log('textToImage called with prompt length: %d', payload.prompt?.length || 0);
            try {
                const res = await this.client.images.generate(payload);
                log('generated %d images', res.data?.length || 0);
                return (res.data || []).map((o) => o.url);
            }
            catch (error) {
                throw this.handleError(error);
            }
        }
        async textToSpeech(payload, options) {
            const log = (0, debug_1.default)(`${this.logPrefix}:textToSpeech`);
            log('textToSpeech called with input length: %d, voice: %s', payload.input?.length || 0, payload.voice);
            try {
                const mp3 = await this.client.audio.speech.create(payload, {
                    headers: options?.headers,
                    signal: options?.signal,
                });
                const buffer = await mp3.arrayBuffer();
                log('generated audio with size: %d bytes', buffer.byteLength);
                return buffer;
            }
            catch (error) {
                throw this.handleError(error);
            }
        }
        handleError(error) {
            const log = (0, debug_1.default)(`${this.logPrefix}:error`);
            log('handling error: %O', error);
            let desensitizedEndpoint = this.baseURL;
            // refs: https://github.com/lobehub/lobe-chat/issues/842
            if (this.baseURL !== DEFAULT_BASE_URL) {
                desensitizedEndpoint = (0, desensitizeUrl_1.desensitizeUrl)(this.baseURL);
            }
            if (chatCompletion?.handleError) {
                log('using custom error handler');
                const errorResult = chatCompletion.handleError(error, this._options);
                if (errorResult)
                    return createError_1.AgentRuntimeError.chat({
                        ...errorResult,
                        provider: this.id,
                    });
            }
            if ('status' in error) {
                const status = error.status;
                log('HTTP error with status: %d', status);
                switch (status) {
                    case 401: {
                        log('invalid API key error');
                        return createError_1.AgentRuntimeError.chat({
                            endpoint: desensitizedEndpoint,
                            error: error,
                            errorType: ErrorType.invalidAPIKey,
                            provider: this.id,
                        });
                    }
                    default: {
                        break;
                    }
                }
            }
            const { errorResult, RuntimeError } = (0, handleOpenAIError_1.handleOpenAIError)(error);
            log('error code: %s, message: %s', errorResult.code, errorResult.message);
            // Check for "Insufficient Balance" in error message
            const errorMessage = errorResult.error?.message || errorResult.message;
            if (errorMessage?.includes('Insufficient Balance')) {
                log('insufficient balance error detected in message');
                return createError_1.AgentRuntimeError.chat({
                    endpoint: desensitizedEndpoint,
                    error: errorResult,
                    errorType: error_1.AgentRuntimeErrorType.InsufficientQuota,
                    provider: this.id,
                });
            }
            switch (errorResult.code) {
                case 'insufficient_quota': {
                    log('insufficient quota error');
                    return createError_1.AgentRuntimeError.chat({
                        endpoint: desensitizedEndpoint,
                        error: errorResult,
                        errorType: error_1.AgentRuntimeErrorType.InsufficientQuota,
                        provider: this.id,
                    });
                }
                case 'model_not_found': {
                    log('model not found error');
                    return createError_1.AgentRuntimeError.chat({
                        endpoint: desensitizedEndpoint,
                        error: errorResult,
                        errorType: error_1.AgentRuntimeErrorType.ModelNotFound,
                        provider: this.id,
                    });
                }
                // content too long
                case 'context_length_exceeded':
                case 'string_above_max_length': {
                    log('context length exceeded error');
                    return createError_1.AgentRuntimeError.chat({
                        endpoint: desensitizedEndpoint,
                        error: errorResult,
                        errorType: error_1.AgentRuntimeErrorType.ExceededContextWindow,
                        provider: this.id,
                    });
                }
            }
            log('returning generic error');
            return createError_1.AgentRuntimeError.chat({
                endpoint: desensitizedEndpoint,
                error: errorResult,
                errorType: RuntimeError || ErrorType.bizError,
                provider: this.id,
            });
        }
        async handleResponseAPIMode(payload, options) {
            const log = (0, debug_1.default)(`${this.logPrefix}:handleResponseAPIMode`);
            log('handleResponseAPIMode called with model: %s', payload.model);
            const inputStartAt = Date.now();
            const { messages, reasoning_effort, tools, reasoning, responseMode, max_tokens, ...res } = responses?.handlePayload
                ? responses?.handlePayload(payload, this._options)
                : payload;
            // remove penalty params and chat completion specific params
            delete res.apiMode;
            delete res.frequency_penalty;
            delete res.presence_penalty;
            const input = await (0, openai_2.convertOpenAIResponseInputs)(messages);
            const isStreaming = payload.stream !== false;
            log('isStreaming: %s, hasTools: %s, hasReasoning: %s', isStreaming, !!tools, !!(reasoning || reasoning_effort));
            const postPayload = {
                ...res,
                ...(reasoning || reasoning_effort
                    ? {
                        reasoning: {
                            ...reasoning,
                            ...(reasoning_effort && { effort: reasoning_effort }),
                        },
                    }
                    : {}),
                input,
                ...(max_tokens && { max_output_tokens: max_tokens }),
                store: false,
                stream: !isStreaming ? undefined : isStreaming,
                tools: tools?.map((tool) => this.convertChatCompletionToolToResponseTool(tool)),
            };
            if (debugParams?.responses?.()) {
                console.log('[requestPayload]');
                console.log(JSON.stringify(postPayload), '\n');
            }
            log('sending responses.create request');
            const response = await this.client.responses.create(postPayload, {
                headers: options?.requestHeaders,
                signal: options?.signal,
            });
            const streamOptions = {
                bizErrorTypeTransformer: chatCompletion?.handleStreamBizErrorType,
                callbacks: options?.callback,
                payload: {
                    model: payload.model,
                    pricing: await (0, getModelPricing_1.getModelPricing)(payload.model, this.id),
                    provider: this.id,
                },
            };
            if (isStreaming) {
                log('processing streaming Responses API response');
                const stream = response;
                const [prod, useForDebug] = stream.tee();
                if (debugParams?.responses?.()) {
                    const useForDebugStream = useForDebug instanceof ReadableStream ? useForDebug : useForDebug.toReadableStream();
                    (0, debugStream_1.debugStream)(useForDebugStream).catch(console.error);
                }
                return (0, response_1.StreamingResponse)((0, streams_1.OpenAIResponsesStream)(prod, { ...streamOptions, inputStartAt }), {
                    headers: options?.headers,
                });
            }
            log('processing non-streaming Responses API response');
            // Handle non-streaming response
            if (debugParams?.responses?.()) {
                (0, debugStream_1.debugResponse)(response);
            }
            if (responseMode === 'json') {
                log('returning JSON response mode');
                return Response.json(response);
            }
            log('transforming non-streaming Responses API response to stream');
            const stream = (0, nonStreamToStream_1.transformResponseAPIToStream)(response);
            return (0, response_1.StreamingResponse)((0, streams_1.OpenAIResponsesStream)(stream, { ...streamOptions, enableStreaming: false, inputStartAt }), {
                headers: options?.headers,
            });
        }
        async generateObjectWithTools(payload, options) {
            const { messages, model, tools, responseApi } = payload;
            const log = (0, debug_1.default)(`${this.logPrefix}:generateObject`);
            log('generateObjectWithTools called with model: %s, toolsCount: %d', model, tools?.length || 0);
            // Factory-level Responses API routing control (supports instance override)
            const instanceGenerateObject = (this._options.generateObject || {});
            const flagUseResponse = instanceGenerateObject.useResponse ??
                (generateObjectConfig ? generateObjectConfig.useResponse : undefined);
            const flagUseResponseModels = instanceGenerateObject.useResponseModels ?? generateObjectConfig?.useResponseModels;
            const shouldUseResponses = this.shouldUseResponsesAPI({
                context: 'tool calling',
                flagUseResponse,
                flagUseResponseModels,
                model,
                responseApi,
            });
            if (shouldUseResponses) {
                log('calling responses.create for tool calling');
                const input = await (0, openai_2.convertOpenAIResponseInputs)(messages);
                const res = await this.client.responses.create({
                    input,
                    model,
                    tool_choice: 'required',
                    tools: tools.map((tool) => this.convertChatCompletionToolToResponseTool(tool)),
                    user: options?.user,
                }, { headers: options?.headers, signal: options?.signal });
                const functionCalls = res.output?.filter((item) => item.type === 'function_call');
                log('received %d function calls from Responses API', functionCalls?.length || 0);
                try {
                    const result = functionCalls?.map((item) => ({
                        arguments: typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments,
                        name: item.name,
                    }));
                    log('successfully parsed function calls: %O', result?.map((r) => r.name));
                    return result;
                }
                catch (error) {
                    log('failed to parse tool call arguments: %O', error);
                    console.error('parse tool call arguments error:', res);
                    return undefined;
                }
            }
            log('calling chat.completions.create for tool calling');
            const msgs = messages;
            const res = await this.client.chat.completions.create({
                messages: msgs,
                model,
                tool_choice: 'required',
                tools,
                user: options?.user,
            }, { headers: options?.headers, signal: options?.signal });
            const toolCalls = res.choices[0].message.tool_calls;
            log('received %d tool calls from Chat Completions API', toolCalls?.length || 0);
            try {
                const result = toolCalls.map((item) => ({
                    arguments: JSON.parse(item.function.arguments),
                    name: item.function.name,
                }));
                log('successfully parsed tool calls: %O', result.map((r) => r.name));
                return result;
            }
            catch (error) {
                log('failed to parse tool call arguments: %O', error);
                console.error('parse tool call arguments error:', res);
                return undefined;
            }
        }
    };
};
exports.createOpenAICompatibleRuntime = createOpenAICompatibleRuntime;
//# sourceMappingURL=index.js.map