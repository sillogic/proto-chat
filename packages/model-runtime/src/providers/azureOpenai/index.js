"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeAzureOpenAI = void 0;
const debug_1 = __importDefault(require("debug"));
const model_bank_1 = require("model-bank");
const openai_1 = require("openai");
const models_1 = require("../../const/models");
const openai_2 = require("../../core/contextBuilders/openai");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const streams_1 = require("../../core/streams");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const debugStream_1 = require("../../utils/debugStream");
const response_1 = require("../../utils/response");
const sanitizeError_1 = require("../../utils/sanitizeError");
const azureImageLogger = (0, debug_1.default)('lobe-image:azure');
class LobeAzureOpenAI {
    constructor(params = {}) {
        // Convert object keys to camel case, copy from `@azure/openai` in `node_modules/@azure/openai/dist/index.cjs`
        this.camelCaseKeys = (obj) => {
            if (typeof obj !== 'object' || !obj)
                return obj;
            if (Array.isArray(obj)) {
                return obj.map((v) => this.camelCaseKeys(v));
            }
            else {
                for (const key of Object.keys(obj)) {
                    const value = obj[key];
                    const newKey = this.tocamelCase(key);
                    if (newKey !== key) {
                        delete obj[key];
                    }
                    obj[newKey] = typeof obj[newKey] === 'object' ? this.camelCaseKeys(value) : value;
                }
                return obj;
            }
        };
        this.tocamelCase = (str) => {
            return str
                .toLowerCase()
                .replaceAll(/(_[a-z])/g, (group) => group.toUpperCase().replace('_', ''));
        };
        this.maskSensitiveUrl = (url) => {
            // 使用正则表达式匹配 'https://' 后面和 '.openai.azure.com/' 前面的内容
            const regex = /^(https:\/\/)([^.]+)(\.openai\.azure\.com\/.*)$/;
            // 使用替换函数
            return url.replace(regex, (match, protocol, subdomain, rest) => {
                // 将子域名替换为 '***'
                return `${protocol}***${rest}`;
            });
        };
        if (!params.apiKey || !params.baseURL)
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey);
        this.client = new openai_1.AzureOpenAI({
            apiKey: params.apiKey,
            apiVersion: params.apiVersion,
            dangerouslyAllowBrowser: true,
            endpoint: params.baseURL,
        });
        this.baseURL = params.baseURL;
    }
    async chat(payload, options) {
        // Remove internal apiMode parameter to prevent sending to Azure OpenAI API
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { messages, model, apiMode: _, ...params } = payload;
        // o1 series models on Azure OpenAI does not support streaming currently
        const enableStreaming = model.includes('o1') ? false : (params.stream ?? true);
        const updatedMessages = messages.map((message) => ({
            ...message,
            role: 
            // Convert 'system' role to 'user' or 'developer' based on the model
            (model.includes('o1') || model.includes('o3') || model.includes('gpt-5')) &&
                message.role === 'system'
                ? [...models_1.systemToUserModels].some((sub) => model.includes(sub))
                    ? 'user'
                    : 'developer'
                : message.role,
        }));
        try {
            // Create parameters with proper typing for OpenAI SDK, handling reasoning_effort compatibility
            const { reasoning_effort, ...otherParams } = params;
            // Convert 'minimal' to 'low' for OpenAI SDK compatibility
            const compatibleReasoningEffort = reasoning_effort === 'minimal' ? 'low' : reasoning_effort;
            const baseParams = {
                messages: await (0, openai_2.convertOpenAIMessages)(updatedMessages),
                model,
                ...otherParams,
                max_completion_tokens: undefined,
                tool_choice: params.tools ? 'auto' : undefined,
            };
            // Add reasoning_effort only if it exists and cast to proper type
            const openaiParams = compatibleReasoningEffort
                ? {
                    ...baseParams,
                    reasoning_effort: compatibleReasoningEffort,
                }
                : baseParams;
            const response = enableStreaming
                ? await this.client.chat.completions.create({ ...openaiParams, stream: true })
                : await this.client.chat.completions.create({ ...openaiParams, stream: false });
            if (enableStreaming) {
                const stream = response;
                const [prod, debug] = stream.tee();
                if (process.env.DEBUG_AZURE_CHAT_COMPLETION === '1') {
                    (0, debugStream_1.debugStream)(debug.toReadableStream()).catch(console.error);
                }
                return (0, response_1.StreamingResponse)((0, streams_1.OpenAIStream)(prod, { callbacks: options?.callback }), {
                    headers: options?.headers,
                });
            }
            else {
                const stream = (0, openaiCompatibleFactory_1.transformResponseToStream)(response);
                return (0, response_1.StreamingResponse)((0, streams_1.OpenAIStream)(stream, { callbacks: options?.callback, enableStreaming: false }), {
                    headers: options?.headers,
                });
            }
        }
        catch (e) {
            return this.handleError(e, model);
        }
    }
    async embeddings(payload, options) {
        try {
            const res = await this.client.embeddings.create({ ...payload, encoding_format: 'float', user: options?.user }, { headers: options?.headers, signal: options?.signal });
            return res.data.map((item) => item.embedding);
        }
        catch (error) {
            return this.handleError(error, payload.model);
        }
    }
    // Create image using Azure OpenAI Images API (gpt-image-1 or DALL·E deployments)
    async createImage(payload) {
        const { model, params } = payload;
        azureImageLogger('Creating image with model: %s and params: %O', model, params);
        try {
            // Clone params and remap imageUrls/imageUrl -> image
            const userInput = { ...params };
            // Convert imageUrls to 'image' for edit API
            if (Array.isArray(userInput.imageUrls) && userInput.imageUrls.length > 0) {
                const imageFiles = await Promise.all(userInput.imageUrls.map((url) => (0, openai_2.convertImageUrlToFile)(url)));
                userInput.image = imageFiles.length === 1 ? imageFiles[0] : imageFiles;
            }
            // Backward compatibility: single imageUrl -> image
            if (userInput.imageUrl && !userInput.image) {
                userInput.image = await (0, openai_2.convertImageUrlToFile)(userInput.imageUrl);
            }
            // Remove non-API parameters to avoid unknown_parameter errors
            delete userInput.imageUrls;
            delete userInput.imageUrl;
            const isImageEdit = Boolean(userInput.image);
            azureImageLogger('Is Image Edit: ' + isImageEdit);
            // Azure/OpenAI Images: remove unsupported/auto values where appropriate
            if (userInput.size === 'auto')
                delete userInput.size;
            // Build options: do not force response_format for gpt-image-1
            const options = {
                model,
                n: 1,
                ...(isImageEdit ? { input_fidelity: 'high' } : {}),
                ...userInput,
            };
            // For generate, ensure no 'image' field is sent
            if (!isImageEdit)
                delete options.image;
            // Call Azure Images API
            const img = isImageEdit
                ? await this.client.images.edit(options)
                : await this.client.images.generate(options);
            // Normalize possible string JSON response -- Sometimes Azure Image API returns a text/plain Content-Type
            let result = img;
            if (typeof result === 'string') {
                try {
                    result = JSON.parse(result);
                }
                catch {
                    const truncated = result.length > 500 ? result.slice(0, 500) + '...[truncated]' : result;
                    azureImageLogger(`Failed to parse string response from images API. Raw response: ${truncated}`);
                    throw new Error('Invalid image response: expected JSON string but parsing failed');
                }
            }
            else if (result && typeof result === 'object') {
                // Handle common Azure REST shapes
                if (typeof result.bodyAsText === 'string') {
                    try {
                        result = JSON.parse(result.bodyAsText);
                    }
                    catch {
                        const rawText = result.bodyAsText;
                        const truncated = rawText.length > 500 ? rawText.slice(0, 500) + '...[truncated]' : rawText;
                        azureImageLogger(`Failed to parse bodyAsText from images API. Raw response: ${truncated}`);
                        throw new Error('Invalid image response: bodyAsText not valid JSON');
                    }
                }
                else if (typeof result.body === 'string') {
                    try {
                        result = JSON.parse(result.body);
                    }
                    catch {
                        azureImageLogger('Failed to parse body from images API response');
                        throw new Error('Invalid image response: body not valid JSON');
                    }
                }
            }
            // Validate response
            if (!result || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
                throw new Error(`Invalid image response: missing or empty data array. Response: ${JSON.stringify(result)}`);
            }
            const imageData = result.data[0];
            if (!imageData)
                throw new Error('Invalid image response: first data item is null or undefined');
            // Prefer base64 if provided, otherwise URL
            if (imageData.b64_json) {
                const mimeType = 'image/png';
                return { imageUrl: `data:${mimeType};base64,${imageData.b64_json}` };
            }
            if (imageData.url) {
                return { imageUrl: imageData.url };
            }
            throw new Error('Invalid image response: missing both b64_json and url fields');
        }
        catch (e) {
            return this.handleError(e, model);
        }
    }
    handleError(e, model) {
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
exports.LobeAzureOpenAI = LobeAzureOpenAI;
//# sourceMappingURL=index.js.map