import { InvokeModelWithResponseStreamResponse } from '@aws-sdk/client-bedrock-runtime';
/**
 * covert the bedrock response to a readable stream
 */
export declare const createBedrockStream: (res: InvokeModelWithResponseStreamResponse) => import("stream/web").ReadableStream<any>;
//# sourceMappingURL=common.d.ts.map