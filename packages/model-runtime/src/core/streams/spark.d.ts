import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import { ChatStreamCallbacks } from '../../types';
import { StreamProtocolChunk } from './protocol';
export declare function transformSparkResponseToStream(data: OpenAI.ChatCompletion): import("stream/web").ReadableStream<any>;
export declare const transformSparkStream: (chunk: OpenAI.ChatCompletionChunk) => StreamProtocolChunk;
export declare const SparkAIStream: (stream: Stream<OpenAI.ChatCompletionChunk> | ReadableStream, { callbacks, inputStartAt }?: {
    callbacks?: ChatStreamCallbacks;
    inputStartAt?: number;
}) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=spark.d.ts.map