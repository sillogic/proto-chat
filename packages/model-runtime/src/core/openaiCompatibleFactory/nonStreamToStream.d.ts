import OpenAI from 'openai';
/**
 * make the OpenAI response data as a stream
 */
export declare const transformResponseToStream: (data: OpenAI.ChatCompletion) => import("stream/web").ReadableStream<any>;
/**
 * transform the OpenAI Response API data to stream format for non-streaming responses
 */
export declare const transformResponseAPIToStream: (data: OpenAI.Responses.Response) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=nonStreamToStream.d.ts.map