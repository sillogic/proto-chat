import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import { ChatStreamCallbacks } from '../../types';
import { StreamContext, StreamProtocolChunk } from './protocol';
export declare const transformQwenStream: (chunk: OpenAI.ChatCompletionChunk, streamContext?: StreamContext) => StreamProtocolChunk | StreamProtocolChunk[];
export declare const QwenAIStream: (stream: Stream<OpenAI.ChatCompletionChunk> | ReadableStream, { callbacks, inputStartAt, enableStreaming, }?: {
    callbacks?: ChatStreamCallbacks;
    enableStreaming?: boolean;
    inputStartAt?: number;
}) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=qwen.d.ts.map