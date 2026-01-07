import { InvokeModelWithResponseStreamResponse } from '@aws-sdk/client-bedrock-runtime';
import { ChatStreamCallbacks } from '../../../types';
import { transformAnthropicStream } from '../anthropic';
export declare const AWSBedrockClaudeStream: (res: InvokeModelWithResponseStreamResponse | ReadableStream, options?: {
    callbacks?: ChatStreamCallbacks;
    inputStartAt?: number;
    payload?: Parameters<typeof transformAnthropicStream>[2];
}) => ReadableStream<string>;
//# sourceMappingURL=claude.d.ts.map