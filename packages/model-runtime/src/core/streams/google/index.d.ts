import { GenerateContentResponse } from '@google/genai';
import { ChatStreamCallbacks } from '../../../types';
import { ChatPayloadForTransformStream } from '../protocol';
export declare const LOBE_ERROR_KEY = "__lobe_error";
export interface GoogleAIStreamOptions {
    callbacks?: ChatStreamCallbacks;
    enableStreaming?: boolean;
    inputStartAt?: number;
    payload?: ChatPayloadForTransformStream;
}
export declare const GoogleGenerativeAIStream: (rawStream: ReadableStream<GenerateContentResponse>, { callbacks, inputStartAt, enableStreaming, payload }?: GoogleAIStreamOptions) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=index.d.ts.map