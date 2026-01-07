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
exports.LobeGoogleAI = exports.resolveModelThinkingBudget = void 0;
const genai_1 = require("@google/genai");
const debug_1 = __importDefault(require("debug"));
const google_1 = require("../../core/contextBuilders/google");
const streams_1 = require("../../core/streams");
const google_2 = require("../../core/streams/google");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const debugStream_1 = require("../../utils/debugStream");
const getModelPricing_1 = require("../../utils/getModelPricing");
const googleErrorParser_1 = require("../../utils/googleErrorParser");
const response_1 = require("../../utils/response");
const createImage_1 = require("./createImage");
const generateObject_1 = require("./generateObject");
const log = (0, debug_1.default)('model-runtime:google');
const modelsOffSafetySettings = new Set(['gemini-2.0-flash-exp']);
const modelsWithModalities = new Set([
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-exp-image-generation',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.5-flash-image-preview',
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
    'nano-banana-pro-preview',
]);
const modelsDisableInstuction = new Set([
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-exp-image-generation',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.5-flash-image-preview',
    'gemini-2.5-flash-image',
    'gemma-3-1b-it',
    'gemma-3-4b-it',
    'gemma-3-12b-it',
    'gemma-3-27b-it',
    'gemma-3n-e4b-it',
    // ZenMux
    'google/gemini-2.5-flash-image-free',
    'google/gemini-2.5-flash-image',
    'google/gemini-3-pro-image-preview-free',
    'google/gemini-3-pro-image-preview',
]);
const PRO_THINKING_MIN = 128;
const PRO_THINKING_MAX = 32768;
const FLASH_THINKING_MAX = 24576;
const FLASH_LITE_THINKING_MIN = 512;
const FLASH_LITE_THINKING_MAX = 24576;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getThinkingModelCategory = (model) => {
    if (!model)
        return 'other';
    const normalized = model.toLowerCase();
    if (normalized.includes('robotics-er-1.5-preview'))
        return 'robotics';
    if (normalized.includes('-2.5-flash-lite') || normalized.includes('flash-lite-latest'))
        return 'flashLite';
    if (normalized.includes('-2.5-flash') || normalized.includes('flash-latest'))
        return 'flash';
    if (normalized.includes('-2.5-pro') || normalized.includes('pro-latest'))
        return 'pro';
    return 'other';
};
const resolveModelThinkingBudget = (model, thinkingBudget) => {
    const category = getThinkingModelCategory(model);
    const hasBudget = thinkingBudget !== undefined && thinkingBudget !== null;
    switch (category) {
        case 'pro': {
            if (!hasBudget)
                return -1;
            if (thinkingBudget === -1)
                return -1;
            return clamp(thinkingBudget, PRO_THINKING_MIN, PRO_THINKING_MAX);
        }
        case 'flash': {
            if (!hasBudget)
                return -1;
            if (thinkingBudget === -1 || thinkingBudget === 0)
                return thinkingBudget;
            return clamp(thinkingBudget, 0, FLASH_THINKING_MAX);
        }
        case 'flashLite':
        case 'robotics': {
            if (!hasBudget)
                return 0;
            if (thinkingBudget === -1 || thinkingBudget === 0)
                return thinkingBudget;
            return clamp(thinkingBudget, FLASH_LITE_THINKING_MIN, FLASH_LITE_THINKING_MAX);
        }
        default: {
            if (!hasBudget)
                return undefined;
            return Math.min(thinkingBudget, FLASH_THINKING_MAX);
        }
    }
};
exports.resolveModelThinkingBudget = resolveModelThinkingBudget;
var HarmCategory;
(function (HarmCategory) {
    HarmCategory["HARM_CATEGORY_DANGEROUS_CONTENT"] = "HARM_CATEGORY_DANGEROUS_CONTENT";
    HarmCategory["HARM_CATEGORY_HARASSMENT"] = "HARM_CATEGORY_HARASSMENT";
    HarmCategory["HARM_CATEGORY_HATE_SPEECH"] = "HARM_CATEGORY_HATE_SPEECH";
    HarmCategory["HARM_CATEGORY_SEXUALLY_EXPLICIT"] = "HARM_CATEGORY_SEXUALLY_EXPLICIT";
})(HarmCategory || (HarmCategory = {}));
var HarmBlockThreshold;
(function (HarmBlockThreshold) {
    HarmBlockThreshold["BLOCK_NONE"] = "BLOCK_NONE";
})(HarmBlockThreshold || (HarmBlockThreshold = {}));
function getThreshold(model) {
    if (modelsOffSafetySettings.has(model)) {
        return 'OFF'; // https://discuss.ai.google.dev/t/59352
    }
    return HarmBlockThreshold.BLOCK_NONE;
}
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
const isAbortError = (error) => {
    const message = error.message.toLowerCase();
    return (message.includes('aborted') ||
        message.includes('cancelled') ||
        message.includes('error reading from the stream') ||
        message.includes('abort') ||
        error.name === 'AbortError');
};
class LobeGoogleAI {
    constructor({ apiKey, baseURL, client, isVertexAi, id, defaultHeaders, } = {}) {
        if (!apiKey)
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey);
        const httpOptions = baseURL
            ? { baseUrl: baseURL, headers: defaultHeaders }
            : undefined;
        this.apiKey = apiKey;
        this.client = client ? client : new genai_1.GoogleGenAI({ apiKey, httpOptions });
        this.baseURL = client ? undefined : baseURL || DEFAULT_BASE_URL;
        this.isVertexAi = isVertexAi || false;
        this.provider = id || (isVertexAi ? 'vertexai' : 'google');
    }
    async chat(rawPayload, options) {
        try {
            const payload = this.buildPayload(rawPayload);
            const { model, thinkingBudget, thinkingLevel, imageAspectRatio, imageResolution } = payload;
            // https://ai.google.dev/gemini-api/docs/thinking#set-budget
            const resolvedThinkingBudget = (0, exports.resolveModelThinkingBudget)(model, thinkingBudget);
            const thinkingConfig = {
                includeThoughts: (!!thinkingBudget ||
                    !!thinkingLevel ||
                    (model &&
                        (model.includes('-3-pro-image') ||
                            model.includes('nano-banana-pro') ||
                            model.includes('thinking')))) &&
                    resolvedThinkingBudget !== 0
                    ? true
                    : undefined,
                thinkingBudget: resolvedThinkingBudget,
            };
            // Add thinkingLevel for 3.0 models
            if (model?.toLowerCase().includes('-3-') && thinkingLevel) {
                thinkingConfig.thinkingLevel = thinkingLevel;
            }
            const contents = await (0, google_1.buildGoogleMessages)(payload.messages);
            const controller = new AbortController();
            const originalSignal = options?.signal;
            if (originalSignal) {
                if (originalSignal.aborted) {
                    controller.abort();
                }
                else {
                    originalSignal.addEventListener('abort', () => {
                        controller.abort();
                    });
                }
            }
            const config = {
                abortSignal: originalSignal,
                imageConfig: modelsWithModalities.has(model) && imageAspectRatio
                    ? {
                        aspectRatio: imageAspectRatio,
                        imageSize: imageResolution,
                    }
                    : undefined,
                maxOutputTokens: payload.max_tokens,
                responseModalities: modelsWithModalities.has(model) ? ['Text', 'Image'] : undefined,
                // avoid wide sensitive words
                // refs: https://github.com/lobehub/lobe-chat/pull/1418
                safetySettings: [
                    {
                        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold: getThreshold(model),
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                        threshold: getThreshold(model),
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                        threshold: getThreshold(model),
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                        threshold: getThreshold(model),
                    },
                ],
                systemInstruction: modelsDisableInstuction.has(model)
                    ? undefined
                    : payload.system,
                temperature: payload.temperature,
                thinkingConfig: modelsDisableInstuction.has(model) || model.toLowerCase().includes('learnlm')
                    ? undefined
                    : thinkingConfig,
                tools: this.buildGoogleToolsWithSearch(payload.tools, payload),
                topP: payload.top_p,
            };
            const inputStartAt = Date.now();
            const finalPayload = { config, contents, model };
            const key = this.isVertexAi
                ? 'DEBUG_VERTEX_AI_CHAT_COMPLETION'
                : 'DEBUG_GOOGLE_CHAT_COMPLETION';
            if (process.env[key] === '1') {
                console.log('[requestPayload]');
                console.log(JSON.stringify(finalPayload), '\n');
            }
            const geminiStreamResponse = await this.client.models.generateContentStream(finalPayload);
            const googleStream = this.createEnhancedStream(geminiStreamResponse, controller.signal);
            const [prod, useForDebug] = googleStream.tee();
            if (process.env[key] === '1') {
                (0, debugStream_1.debugStream)(useForDebug).catch();
            }
            // Convert the response into a friendly text-stream
            const pricing = await (0, getModelPricing_1.getModelPricing)(model, this.provider);
            const Stream = this.isVertexAi ? streams_1.VertexAIStream : streams_1.GoogleGenerativeAIStream;
            const stream = Stream(prod, {
                callbacks: options?.callback,
                inputStartAt,
                payload: { model, pricing, provider: this.provider },
            });
            // Respond with the stream
            return (0, response_1.StreamingResponse)(stream, { headers: options?.headers });
        }
        catch (e) {
            const err = e;
            // 移除之前的静默处理，统一抛出错误
            if (isAbortError(err)) {
                log('Request was cancelled');
                throw createError_1.AgentRuntimeError.chat({
                    error: { message: 'Request was cancelled' },
                    errorType: error_1.AgentRuntimeErrorType.ProviderBizError,
                    provider: this.provider,
                });
            }
            log('Error: %O', err);
            const { errorType, error } = (0, googleErrorParser_1.parseGoogleErrorMessage)(err.message);
            throw createError_1.AgentRuntimeError.chat({ error, errorType, provider: this.provider });
        }
    }
    /**
     * Generate images using Google AI Imagen API or Gemini Chat Models
     * @see https://ai.google.dev/gemini-api/docs/image-generation#imagen
     */
    async createImage(payload) {
        return (0, createImage_1.createGoogleImage)(this.client, this.provider, payload);
    }
    /**
     * Generate structured output using Google Gemini API
     * @see https://ai.google.dev/gemini-api/docs/structured-output
     * @see https://ai.google.dev/gemini-api/docs/function-calling
     */
    async generateObject(payload, options) {
        // Convert OpenAI messages to Google format
        const contents = await (0, google_1.buildGoogleMessages)(payload.messages);
        // Handle tools-based structured output
        if (payload.tools && payload.tools.length > 0) {
            return (0, generateObject_1.createGoogleGenerateObjectWithTools)(this.client, { contents, model: payload.model, tools: payload.tools }, options);
        }
        // Handle schema-based structured output
        if (payload.schema) {
            return (0, generateObject_1.createGoogleGenerateObject)(this.client, { contents, model: payload.model, schema: payload.schema }, options);
        }
        return undefined;
    }
    createEnhancedStream(originalStream, signal) {
        // capture provider for error payloads inside the stream closure
        const provider = this.provider;
        return new ReadableStream({
            async start(controller) {
                let hasData = false;
                try {
                    for await (const chunk of originalStream) {
                        if (signal.aborted) {
                            // 如果有数据已经输出，优雅地关闭流而不是抛出错误
                            if (hasData) {
                                log('Stream cancelled gracefully, preserving existing output');
                                // 显式注入取消错误，避免走 SSE 兜底 unexpected_end
                                controller.enqueue({
                                    [google_2.LOBE_ERROR_KEY]: {
                                        body: { name: 'Stream cancelled', provider, reason: 'aborted' },
                                        message: 'Stream cancelled',
                                        name: 'Stream cancelled',
                                        type: error_1.AgentRuntimeErrorType.StreamChunkError,
                                    },
                                });
                                controller.close();
                                return;
                            }
                            else {
                                // 如果还没有数据输出，直接关闭流，由下游 SSE 在 flush 阶段补发错误事件
                                log('Stream cancelled before any output');
                                controller.close();
                                return;
                            }
                        }
                        hasData = true;
                        controller.enqueue(chunk);
                    }
                }
                catch (error) {
                    const err = error;
                    // 统一处理所有错误，包括 abort 错误
                    if (isAbortError(err) || signal.aborted) {
                        // 如果有数据已经输出，优雅地关闭流
                        if (hasData) {
                            log('Stream reading cancelled gracefully, preserving existing output');
                            // 显式注入取消错误，避免走 SSE 兜底 unexpected_end
                            controller.enqueue({
                                [google_2.LOBE_ERROR_KEY]: {
                                    body: { name: 'Stream cancelled', provider, reason: 'aborted' },
                                    message: 'Stream cancelled',
                                    name: 'Stream cancelled',
                                    type: error_1.AgentRuntimeErrorType.StreamChunkError,
                                },
                            });
                            controller.close();
                            return;
                        }
                        else {
                            log('Stream reading cancelled before any output');
                            // 注入一个带详细错误信息的错误标记，交由下游 google-ai transformer 输出 error 事件
                            controller.enqueue({
                                [google_2.LOBE_ERROR_KEY]: {
                                    body: {
                                        message: err.message,
                                        name: 'AbortError',
                                        provider,
                                        stack: err.stack,
                                    },
                                    message: err.message || 'Request was cancelled',
                                    name: 'AbortError',
                                    type: error_1.AgentRuntimeErrorType.StreamChunkError,
                                },
                            });
                            controller.close();
                            return;
                        }
                    }
                    else {
                        // 处理其他流解析错误
                        log('Stream parsing error: %O', err);
                        // 尝试解析 Google 错误并提取 code/message/status
                        const { error: parsedError, errorType } = (0, googleErrorParser_1.parseGoogleErrorMessage)(err?.message || String(err));
                        // 注入一个带详细错误信息的错误标记，交由下游 google-ai transformer 输出 error 事件
                        controller.enqueue({
                            [google_2.LOBE_ERROR_KEY]: {
                                body: { ...parsedError, provider },
                                message: parsedError?.message || err.message || 'Stream parsing error',
                                name: 'Stream parsing error',
                                type: errorType ?? error_1.AgentRuntimeErrorType.StreamChunkError,
                            },
                        });
                        controller.close();
                        return;
                    }
                }
                controller.close();
            },
        });
    }
    async models(options) {
        try {
            const url = `${this.baseURL}/v1beta/models?key=${this.apiKey}`;
            const response = await fetch(url, {
                method: 'GET',
                signal: options?.signal,
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const json = await response.json();
            const modelList = json.models;
            const processedModels = modelList.map((model) => {
                const id = model.name.replace(/^models\//, '');
                return {
                    contextWindowTokens: (model.inputTokenLimit || 0) + (model.outputTokenLimit || 0),
                    displayName: model.displayName || id,
                    id,
                    maxOutput: model.outputTokenLimit || undefined,
                };
            });
            const { MODEL_LIST_CONFIGS, processModelList } = await Promise.resolve().then(() => __importStar(require('../../utils/modelParse')));
            return processModelList(processedModels, MODEL_LIST_CONFIGS.google, 'google');
        }
        catch (error) {
            log('Failed to fetch Google models: %O', error);
            throw error;
        }
    }
    buildPayload(payload) {
        const system_message = payload.messages.find((m) => m.role === 'system');
        const user_messages = payload.messages.filter((m) => m.role !== 'system');
        return {
            ...payload,
            messages: user_messages,
            system: system_message?.content,
        };
    }
    buildGoogleToolsWithSearch(tools, payload) {
        const hasToolCalls = payload?.messages?.some((m) => m.tool_calls?.length);
        const hasSearch = payload?.enabledSearch;
        const hasUrlContext = payload?.urlContext;
        const hasFunctionTools = tools && tools.length > 0;
        // 如果已经有 tool_calls，优先处理 function declarations
        if (hasToolCalls && hasFunctionTools) {
            return (0, google_1.buildGoogleTools)(tools);
        }
        // 构建并返回搜索相关工具（搜索工具不能与 FunctionCall 同时使用）
        if (hasUrlContext && hasSearch) {
            return [{ urlContext: {} }, { googleSearch: {} }];
        }
        if (hasUrlContext) {
            return [{ urlContext: {} }];
        }
        if (hasSearch) {
            return [{ googleSearch: {} }];
        }
        // 最后考虑 function declarations
        return (0, google_1.buildGoogleTools)(tools);
    }
}
exports.LobeGoogleAI = LobeGoogleAI;
exports.default = LobeGoogleAI;
//# sourceMappingURL=index.js.map