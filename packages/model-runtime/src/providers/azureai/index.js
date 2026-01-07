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
exports.LobeAzureAI = void 0;
const ai_inference_1 = __importDefault(require("@azure-rest/ai-inference"));
const core_auth_1 = require("@azure/core-auth");
const model_bank_1 = require("model-bank");
const models_1 = require("../../const/models");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const streams_1 = require("../../core/streams");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const debugStream_1 = require("../../utils/debugStream");
const response_1 = require("../../utils/response");
const sanitizeError_1 = require("../../utils/sanitizeError");
class LobeAzureAI {
    constructor(params) {
        this.maskSensitiveUrl = (url) => {
            // 使用正则表达式匹配 'https://' 后面和 '.azure.com/' 前面的内容
            const regex = /^(https:\/\/)([^.]+)(\.cognitiveservices\.azure\.com\/.*)$/;
            // 使用替换函数
            return url.replace(regex, (match, protocol, subdomain, rest) => {
                // 将子域名替换为 '***'
                return `${protocol}***${rest}`;
            });
        };
        if (!params?.apiKey || !params?.baseURL)
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey);
        this.client = (0, ai_inference_1.default)(params?.baseURL, new core_auth_1.AzureKeyCredential(params?.apiKey));
        this.baseURL = params?.baseURL;
    }
    async chat(payload, options) {
        // Remove internal apiMode parameter to prevent sending to Azure AI API
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { messages, model, temperature, top_p, apiMode: _, ...params } = payload;
        // o1 series models on Azure OpenAI does not support streaming currently
        const enableStreaming = model.includes('o1') ? false : (params.stream ?? true);
        const updatedMessages = messages.map((message) => ({
            ...message,
            role: 
            // Convert 'system' role to 'user' or 'developer' based on the model
            (model.includes('o1') || model.includes('o3')) && message.role === 'system'
                ? [...models_1.systemToUserModels].some((sub) => model.includes(sub))
                    ? 'user'
                    : 'developer'
                : message.role,
        }));
        try {
            const response = this.client.path('/chat/completions').post({
                body: {
                    messages: updatedMessages,
                    model,
                    ...params,
                    stream: enableStreaming,
                    temperature: model.includes('o3') || model.includes('o4') ? undefined : temperature,
                    tool_choice: params.tools ? 'auto' : undefined,
                    top_p: model.includes('o3') || model.includes('o4') ? undefined : top_p,
                },
            });
            if (enableStreaming) {
                const unifiedStream = await (async () => {
                    if (typeof window === 'undefined') {
                        /**
                         * In Node.js the SDK exposes a Node readable stream, so we convert it to a Web ReadableStream
                         * to reuse the same streaming pipeline used by Edge/browser runtimes.
                         */
                        const streamModule = await Promise.resolve().then(() => __importStar(require('node:stream')));
                        const Readable = streamModule.Readable ?? streamModule.default.Readable;
                        if (!Readable)
                            throw new Error('node:stream module missing Readable export');
                        if (typeof Readable.toWeb !== 'function')
                            throw new Error('Readable.toWeb is not a function');
                        const nodeResponse = await response.asNodeStream();
                        const nodeStream = nodeResponse.body;
                        if (!nodeStream) {
                            throw new Error('Azure AI response body is empty');
                        }
                        return Readable.toWeb(nodeStream);
                    }
                    const browserResponse = await response.asBrowserStream();
                    const browserStream = browserResponse.body;
                    if (!browserStream) {
                        throw new Error('Azure AI response body is empty');
                    }
                    return browserStream;
                })();
                const [prod, debug] = unifiedStream.tee();
                if (process.env.DEBUG_AZURE_AI_CHAT_COMPLETION === '1') {
                    (0, debugStream_1.debugStream)(debug).catch(console.error);
                }
                return (0, response_1.StreamingResponse)((0, streams_1.OpenAIStream)(prod.pipeThrough((0, streams_1.createSSEDataExtractor)()), {
                    callbacks: options?.callback,
                }), {
                    headers: options?.headers,
                });
            }
            else {
                const res = await response;
                // the azure AI inference response is openai compatible
                const stream = (0, openaiCompatibleFactory_1.transformResponseToStream)(res.body);
                return (0, response_1.StreamingResponse)((0, streams_1.OpenAIStream)(stream, { callbacks: options?.callback, enableStreaming: false }), {
                    headers: options?.headers,
                });
            }
        }
        catch (e) {
            let error = e;
            if (error.code) {
                switch (error.code) {
                    case 'DeploymentNotFound': {
                        error = { ...error, deployId: model };
                    }
                }
            }
            else {
                error = {
                    cause: error.cause,
                    message: error.message,
                    name: error.name,
                };
            }
            const errorType = error.code
                ? error_1.AgentRuntimeErrorType.ProviderBizError
                : error_1.AgentRuntimeErrorType.AgentRuntimeError;
            // Sanitize error to remove sensitive information like API keys from headers
            const sanitizedError = (0, sanitizeError_1.sanitizeError)(error);
            throw createError_1.AgentRuntimeError.chat({
                endpoint: this.maskSensitiveUrl(this.baseURL),
                error: sanitizedError,
                errorType,
                provider: model_bank_1.ModelProvider.Azure,
            });
        }
    }
}
exports.LobeAzureAI = LobeAzureAI;
//# sourceMappingURL=index.js.map