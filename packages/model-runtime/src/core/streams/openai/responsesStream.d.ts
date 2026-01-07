import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import { OpenAIStreamOptions } from './openai';
export declare const OpenAIResponsesStream: (stream: Stream<OpenAI.Responses.ResponseStreamEvent> | ReadableStream, { callbacks, bizErrorTypeTransformer, inputStartAt, enableStreaming, payload, }?: OpenAIStreamOptions) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=responsesStream.d.ts.map