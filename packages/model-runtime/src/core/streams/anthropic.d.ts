import Anthropic from '@anthropic-ai/sdk';
import type { Stream } from '@anthropic-ai/sdk/streaming';
import { ChatStreamCallbacks } from '../../types';
import { ChatPayloadForTransformStream, StreamContext, StreamProtocolChunk } from './protocol';
export declare const transformAnthropicStream: (chunk: Anthropic.MessageStreamEvent, context: StreamContext, payload?: ChatPayloadForTransformStream) => StreamProtocolChunk | StreamProtocolChunk[];
export interface AnthropicStreamOptions {
    callbacks?: ChatStreamCallbacks;
    enableStreaming?: boolean;
    inputStartAt?: number;
    payload?: ChatPayloadForTransformStream;
}
export declare const AnthropicStream: (stream: Stream<Anthropic.MessageStreamEvent> | ReadableStream, { callbacks, inputStartAt, enableStreaming, payload }?: AnthropicStreamOptions) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=anthropic.d.ts.map