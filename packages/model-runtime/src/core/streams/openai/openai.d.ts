import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import { ChatStreamCallbacks } from '../../../types';
import { ILobeAgentRuntimeErrorType } from '../../../types/error';
import { ChatPayloadForTransformStream } from '../protocol';
export interface OpenAIStreamOptions {
    bizErrorTypeTransformer?: (error: {
        message: string;
        name: string;
    }) => ILobeAgentRuntimeErrorType | undefined;
    callbacks?: ChatStreamCallbacks;
    enableStreaming?: boolean;
    inputStartAt?: number;
    payload?: ChatPayloadForTransformStream;
}
export declare const OpenAIStream: (stream: Stream<OpenAI.ChatCompletionChunk> | ReadableStream, { callbacks, bizErrorTypeTransformer, payload, inputStartAt, enableStreaming, }?: OpenAIStreamOptions) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=openai.d.ts.map