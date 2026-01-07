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
exports.LobeOllamaAI = exports.params = void 0;
const utils_1 = require("@lobechat/utils");
const model_bank_1 = require("model-bank");
const browser_1 = require("ollama/browser");
const streams_1 = require("../../core/streams");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const debugStream_1 = require("../../utils/debugStream");
const errorResponse_1 = require("../../utils/errorResponse");
const response_1 = require("../../utils/response");
const uriParser_1 = require("../../utils/uriParser");
exports.params = {
    baseURL: undefined,
    debug: {
        chatCompletion: () => process.env.DEBUG_OLLAMA_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.Ollama,
};
class LobeOllamaAI {
    constructor({ baseURL } = {}) {
        this.invokeEmbeddingModel = async (payload) => {
            try {
                const responseBody = await this.client.embeddings({
                    model: payload.model,
                    prompt: payload.input,
                });
                return responseBody.embedding;
            }
            catch (error) {
                const e = error;
                throw createError_1.AgentRuntimeError.chat({
                    error: { message: e.message, name: e.name, status_code: e.status_code },
                    errorType: error_1.AgentRuntimeErrorType.OllamaBizError,
                    provider: model_bank_1.ModelProvider.Ollama,
                });
            }
        };
        this.convertContentToOllamaMessage = async (message) => {
            if (typeof message.content === 'string') {
                return { content: message.content, role: message.role };
            }
            const ollamaMessage = {
                content: '',
                role: message.role,
            };
            // Collect image processing tasks for parallel execution
            const imagePromises = [];
            for (const content of message.content) {
                switch (content.type) {
                    case 'text': {
                        // keep latest text input
                        ollamaMessage.content = content.text;
                        break;
                    }
                    case 'image_url': {
                        const { base64, type } = (0, uriParser_1.parseDataUri)(content.image_url.url);
                        // If already base64 format, use it directly
                        if (base64) {
                            imagePromises.push(base64);
                        }
                        // If it's a URL, add async conversion task with error handling
                        else if (type === 'url') {
                            imagePromises.push((0, utils_1.imageUrlToBase64)(content.image_url.url)
                                .then((result) => result.base64)
                                .catch(() => null));
                        }
                        break;
                    }
                }
            }
            // Process all images in parallel and filter out failed conversions
            if (imagePromises.length > 0) {
                const results = await Promise.all(imagePromises);
                const validImages = results.filter((img) => img !== null);
                if (validImages.length > 0) {
                    ollamaMessage.images = validImages;
                }
            }
            return ollamaMessage;
        };
        try {
            if (baseURL)
                new URL(baseURL);
        }
        catch (e) {
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidOllamaArgs, e);
        }
        this.client = new browser_1.Ollama(!baseURL ? undefined : { host: baseURL });
        if (baseURL)
            this.baseURL = baseURL;
    }
    async chat(payload, options) {
        try {
            const abort = () => {
                this.client.abort();
                options?.signal?.removeEventListener('abort', abort);
            };
            options?.signal?.addEventListener('abort', abort);
            const response = await this.client.chat({
                messages: await this.buildOllamaMessages(payload.messages),
                model: payload.model,
                options: {
                    frequency_penalty: payload.frequency_penalty,
                    presence_penalty: payload.presence_penalty,
                    temperature: payload.temperature !== undefined ? payload.temperature / 2 : undefined,
                    top_p: payload.top_p,
                },
                stream: true,
                tools: payload.tools,
            });
            const stream = (0, streams_1.convertIterableToStream)(response);
            const [prod, debug] = stream.tee();
            if (process.env.DEBUG_OLLAMA_CHAT_COMPLETION === '1') {
                (0, debugStream_1.debugStream)(debug).catch(console.error);
            }
            return (0, response_1.StreamingResponse)((0, streams_1.OllamaStream)(prod, options?.callback), {
                headers: options?.headers,
            });
        }
        catch (error) {
            const e = error;
            if (e.message === 'fetch failed') {
                throw createError_1.AgentRuntimeError.chat({
                    error: {
                        message: 'please check whether your ollama service is available',
                    },
                    errorType: error_1.AgentRuntimeErrorType.OllamaServiceUnavailable,
                    provider: model_bank_1.ModelProvider.Ollama,
                });
            }
            throw createError_1.AgentRuntimeError.chat({
                error: {
                    ...(typeof e.error !== 'string' ? e.error : undefined),
                    message: String(e.error?.message || e.message),
                    name: e.name,
                    status_code: e.status_code,
                },
                errorType: error_1.AgentRuntimeErrorType.OllamaBizError,
                provider: model_bank_1.ModelProvider.Ollama,
            });
        }
    }
    async embeddings(payload) {
        const input = Array.isArray(payload.input) ? payload.input : [payload.input];
        const promises = input.map((inputText) => this.invokeEmbeddingModel({
            dimensions: payload.dimensions,
            input: inputText,
            model: payload.model,
        }));
        return await Promise.all(promises);
    }
    async models() {
        const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
        const list = await this.client.list();
        const modelList = list.models;
        return modelList
            .map((model) => {
            const knownModel = LOBE_DEFAULT_MODEL_LIST.find((m) => model.name.toLowerCase() === m.id.toLowerCase());
            return {
                contextWindowTokens: knownModel?.contextWindowTokens ?? undefined,
                displayName: knownModel?.displayName ?? undefined,
                enabled: knownModel?.enabled || false,
                functionCall: knownModel?.abilities?.functionCall || false,
                id: model.name,
                reasoning: knownModel?.abilities?.reasoning || false,
                vision: knownModel?.abilities?.vision || false,
            };
        })
            .filter(Boolean);
    }
    async buildOllamaMessages(messages) {
        return Promise.all(messages.map((message) => this.convertContentToOllamaMessage(message)));
    }
    async pullModel(params, options) {
        const { model, insecure } = params;
        const signal = options?.signal; // 获取传入的 AbortSignal
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const abortOllama = () => {
            // 假设 this.client.abort() 是幂等的或者可以安全地多次调用
            this.client.abort();
        };
        // 如果有 AbortSignal，监听 abort 事件
        // 使用 { once: true } 确保监听器只触发一次
        signal?.addEventListener('abort', abortOllama, { once: true });
        try {
            // 获取 Ollama pull 的迭代器
            const iterable = await this.client.pull({
                insecure: insecure ?? false,
                model,
                stream: true,
            });
            // 使用专门的模型下载流转换方法
            const progressStream = (0, streams_1.createModelPullStream)(iterable, model, {
                onCancel: () => {
                    // 当流被取消时，调用 abortOllama
                    // 移除 signal 的监听器，避免重复调用（如果 abortOllama 不是幂等的）
                    signal?.removeEventListener('abort', abortOllama);
                    abortOllama(); // 执行中止逻辑
                },
            });
            // 返回标准响应
            return new Response(progressStream, {
                headers: { 'Content-Type': 'application/json' },
            });
        }
        catch (error) {
            // 如果在调用 client.pull 或创建流的初始阶段出错，需要移除监听器
            signal?.removeEventListener('abort', abortOllama);
            // 处理错误
            if (error.message === 'fetch failed') {
                return (0, errorResponse_1.createErrorResponse)(error_1.AgentRuntimeErrorType.OllamaServiceUnavailable, {
                    message: 'please check whether your ollama service is available',
                    provider: model_bank_1.ModelProvider.Ollama,
                });
            }
            console.error('model download error:', error);
            // 检查是否是取消操作
            if (error.name === 'AbortError') {
                return new Response(JSON.stringify({
                    model,
                    status: 'cancelled',
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 499,
                });
            }
            // 返回错误响应
            const errorMessage = error instanceof Error ? error.message : String(error);
            return new Response(JSON.stringify({
                error: errorMessage,
                model,
                status: 'error',
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 500,
            });
        }
    }
}
exports.LobeOllamaAI = LobeOllamaAI;
exports.default = LobeOllamaAI;
//# sourceMappingURL=index.js.map