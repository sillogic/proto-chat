import { ChatCitationItem, ModelUsage } from '@lobechat/types';
import type { Pricing } from 'model-bank';
import { ChatStreamCallbacks } from '../../types';
import type { ComputeChatCostOptions } from '../usageConverters/utils/computeChatCost';
export type ChatPayloadForTransformStream = {
    model?: string;
    pricing?: Pricing;
    pricingOptions?: ComputeChatCostOptions;
    provider?: string;
};
/**
 * context in the stream to save temporarily data
 */
export interface StreamContext {
    id: string;
    /**
     * As pplx citations is in every chunk, but we only need to return it once
     * this flag is used to check if the pplx citation is returned,and then not return it again.
     * Same as Hunyuan and Wenxin
     */
    returnedCitation?: boolean;
    /**
     * Claude's citations are inline and interleaved with text output.
     * Each text segment may carry references to sources (e.g., web search results)
     * relevant to that specific portion of the generated content.
     * This array accumulates all citation items received during the streaming response.
     */
    returnedCitationArray?: ChatCitationItem[];
    /**
     * O series models need a condition to separate part
     */
    startReasoning?: boolean;
    thinking?: {
        id: string;
        name: string;
    };
    /**
     * Indicates whether the current state is within a "thinking" segment of the model output
     * (e.g., when processing lmstudio responses).
     *
     * When parsing output containing <think> and </think> tags:
     * - Set to `true` upon encountering a <think> tag (entering reasoning mode)
     * - Set to `false` upon encountering a </think> tag (exiting reasoning mode)
     *
     * While `thinkingInContent` is `true`, subsequent content should be stored in `reasoning_content`.
     * When `false`, content should be stored in the regular `content` field.
     */
    thinkingInContent?: boolean;
    tool?: {
        id: string;
        index: number;
        name: string;
    };
    toolIndex?: number;
    usage?: ModelUsage;
}
export interface StreamProtocolChunk {
    data: any;
    id?: string;
    type: 'text' | 'base64_image' | 'tool_calls' | 'reasoning' | 'reasoning_signature' | 'flagged_reasoning_signature' | 'reasoning_part' | 'content_part' | 'grounding' | 'stop' | 'error' | 'usage' | 'speed' | 'data';
}
/**
 * Stream content part chunk data for multimodal support
 */
export interface StreamPartChunkData {
    content: string;
    inReasoning: boolean;
    mimeType?: string;
    partType: 'text' | 'image';
    thoughtSignature?: string;
}
export interface StreamToolCallChunkData {
    function?: {
        arguments?: string;
        name?: string | null;
    };
    id?: string;
    index: number;
    thoughtSignature?: string;
    type: 'function' | string;
}
export interface StreamProtocolToolCallChunk {
    data: StreamToolCallChunkData[];
    id: string;
    type: 'tool_calls';
}
export declare const generateToolCallId: (index: number, functionName?: string) => string;
export declare function readableFromAsyncIterable<T>(iterable: AsyncIterable<T>): import("stream/web").ReadableStream<T>;
export declare const convertIterableToStream: <T>(stream: AsyncIterable<T>) => import("stream/web").ReadableStream<T>;
/**
 * Create a transformer to convert the response into an SSE format
 */
export declare const createSSEProtocolTransformer: (transformer: (chunk: any, stack: StreamContext) => StreamProtocolChunk | StreamProtocolChunk[], streamStack?: StreamContext, options?: {
    requireTerminalEvent?: boolean;
}) => import("stream/web").TransformStream<any, any>;
export declare function createCallbacksTransformer(cb: ChatStreamCallbacks | undefined): import("stream/web").TransformStream<string, any>;
export declare const FIRST_CHUNK_ERROR_KEY = "_isFirstChunkError";
export declare const createFirstErrorHandleTransformer: (errorHandler?: (errorJson: any) => any, provider?: string) => import("stream/web").TransformStream<any, any>;
/**
 * create a transformer to remove SSE format data
 */
export declare const createSSEDataExtractor: () => import("stream/web").TransformStream<Uint8Array<ArrayBufferLike>, any>;
export declare const TOKEN_SPEED_CHUNK_ID = "output_speed";
/**
 * Create a middleware to calculate the token generate speed
 * @requires createSSEProtocolTransformer
 */
export declare const createTokenSpeedCalculator: (transformer: (chunk: any, stack: StreamContext) => StreamProtocolChunk | StreamProtocolChunk[], { inputStartAt, streamStack, enableStreaming, }?: {
    enableStreaming?: boolean;
    inputStartAt?: number;
    streamStack?: StreamContext;
}) => import("stream/web").TransformStream<any, any>;
//# sourceMappingURL=protocol.d.ts.map