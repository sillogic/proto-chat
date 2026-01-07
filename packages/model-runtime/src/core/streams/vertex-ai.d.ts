import { GenerateContentResponse } from '@google/genai';
import { type GoogleAIStreamOptions } from './google';
export declare const VertexAIStream: (rawStream: ReadableStream<GenerateContentResponse>, { callbacks, inputStartAt, enableStreaming, payload }?: GoogleAIStreamOptions) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=vertex-ai.d.ts.map