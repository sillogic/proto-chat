import { InvokeModelWithResponseStreamResponse } from '@aws-sdk/client-bedrock-runtime';
import { ChatStreamCallbacks } from '../../../types';
import { StreamContext, StreamProtocolChunk } from '../protocol';
interface AmazonBedrockInvocationMetrics {
    firstByteLatency: number;
    inputTokenCount: number;
    invocationLatency: number;
    outputTokenCount: number;
}
interface BedrockLlamaStreamChunk {
    'amazon-bedrock-invocationMetrics'?: AmazonBedrockInvocationMetrics;
    'generation': string;
    'generation_token_count': number;
    'prompt_token_count'?: number | null;
    'stop_reason'?: null | 'stop' | string;
}
export declare const transformLlamaStream: (chunk: BedrockLlamaStreamChunk, stack: StreamContext) => StreamProtocolChunk;
export declare const AWSBedrockLlamaStream: (res: InvokeModelWithResponseStreamResponse | ReadableStream, cb?: ChatStreamCallbacks) => ReadableStream<string>;
export {};
//# sourceMappingURL=llama.d.ts.map