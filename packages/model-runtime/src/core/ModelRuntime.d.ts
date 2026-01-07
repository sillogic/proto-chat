import type { TracePayload } from '@lobechat/types';
import { ClientOptions } from 'openai';
import { LobeBedrockAIParams } from '../providers/bedrock';
import { LobeCloudflareParams } from '../providers/cloudflare';
import { ChatMethodOptions, ChatStreamPayload, EmbeddingsOptions, EmbeddingsPayload, GenerateObjectPayload, ModelRequestOptions, PullModelParams, TextToImagePayload, TextToSpeechPayload } from '../types';
import { CreateImagePayload } from '../types/image';
import { LobeRuntimeAI } from './BaseAI';
export interface AgentChatOptions {
    enableTrace?: boolean;
    provider: string;
    trace?: TracePayload;
}
export declare class ModelRuntime {
    private _runtime;
    constructor(runtime: LobeRuntimeAI);
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
    chat(payload: ChatStreamPayload, options?: ChatMethodOptions): Promise<Response>;
    generateObject(payload: GenerateObjectPayload): Promise<any>;
    textToImage(payload: TextToImagePayload): Promise<string[] | undefined>;
    createImage(payload: CreateImagePayload): Promise<import("../types").CreateImageResponse | undefined>;
    models(): Promise<any>;
    embeddings(payload: EmbeddingsPayload, options?: EmbeddingsOptions): Promise<import("../types").Embeddings[] | undefined>;
    textToSpeech(payload: TextToSpeechPayload, options?: EmbeddingsOptions): Promise<ArrayBuffer | undefined>;
    pullModel(params: PullModelParams, options?: ModelRequestOptions): Promise<Response | undefined>;
    /**
     * Get authentication headers if runtime supports it
     */
    getAuthHeaders(): Record<string, string> | undefined;
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
    static initializeWithProvider(provider: string, params: Partial<ClientOptions & LobeBedrockAIParams & LobeCloudflareParams & {
        apiKey?: string;
        apiVersion?: string;
        baseURL?: string;
    }>): ModelRuntime;
}
//# sourceMappingURL=ModelRuntime.d.ts.map