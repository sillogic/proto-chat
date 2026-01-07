"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRuntime = void 0;
const openai_1 = require("../providers/openai");
const runtimeMap_1 = require("../runtimeMap");
const error_1 = require("../types/error");
const createError_1 = require("../utils/createError");
class ModelRuntime {
    constructor(runtime) {
        this._runtime = runtime;
    }
    /**
     * Initiates a chat session with the agent.
     *
     * @param payload - The payload containing the chat stream data.
     * @param options - Optional chat competition options.
     * @returns A Promise that resolves to the chat response.
     *
     * @example - Use without trace
     * ```ts
     * const agentRuntime = await initializeWithClientStore({ provider, payload });
     * const data = payload as ChatStreamPayload;
     * return await agentRuntime.chat(data);
     * ```
     *
     * @example - Use Langfuse trace
     * ```ts
     * // ============  1. init chat model   ============ //
     * const agentRuntime = await initAgentRuntimeWithUserPayload(provider, jwtPayload);
     * // ============  2. create chat completion   ============ //
     * const data = {
     * // your trace options here
     *  } as ChatStreamPayload;
     * const tracePayload = getTracePayload(req);
     * return await agentRuntime.chat(data, createTraceOptions(data, {
     *   provider,
     *   trace: tracePayload,
     * }));
     * ```
     */
    async chat(payload, options) {
        if (typeof this._runtime.chat !== 'function') {
            throw createError_1.AgentRuntimeError.chat({
                error: new Error('Chat is not supported by this provider'),
                errorType: error_1.AgentRuntimeErrorType.ProviderBizError,
                provider: payload.provider || 'unknown',
            });
        }
        return this._runtime.chat(payload, options);
    }
    async generateObject(payload) {
        return this._runtime.generateObject(payload);
    }
    async textToImage(payload) {
        return this._runtime.textToImage?.(payload);
    }
    async createImage(payload) {
        return this._runtime.createImage?.(payload);
    }
    async models() {
        return this._runtime.models?.();
    }
    async embeddings(payload, options) {
        return this._runtime.embeddings?.(payload, options);
    }
    async textToSpeech(payload, options) {
        return this._runtime.textToSpeech?.(payload, options);
    }
    async pullModel(params, options) {
        return this._runtime.pullModel?.(params, options);
    }
    /**
     * Get authentication headers if runtime supports it
     */
    getAuthHeaders() {
        return this._runtime.getAuthHeaders?.();
    }
    /**
     * @description Initialize the runtime with the provider and the options
     * @param provider choose a model provider
     * @param params options of the choosed provider
     * @returns the runtime instance
     * Try to initialize the runtime with the provider and the options.
     * @example
     * ```ts
     * const runtime = await AgentRuntime.initializeWithProviderOptions(provider, options)
     * ```
     * **Note**: If you try to get a AgentRuntime instance from client or server,
     * you should use the methods to get the runtime instance at first.
     * - `src/app/api/chat/agentRuntime.ts: initAgentRuntimeWithUserPayload` on server
     * - `src/services/chat.ts: initializeWithClientStore` on client
     */
    static initializeWithProvider(provider, params) {
        // @ts-expect-error runtime map not include vertex so it will be undefined
        const providerAI = runtimeMap_1.providerRuntimeMap[provider] ?? openai_1.LobeOpenAI;
        const runtimeModel = new providerAI(params);
        return new ModelRuntime(runtimeModel);
    }
}
exports.ModelRuntime = ModelRuntime;
//# sourceMappingURL=ModelRuntime.js.map