import Anthropic from '@anthropic-ai/sdk';
import { ModelUsage } from '@lobechat/types';
import { ChatPayloadForTransformStream } from '../streams/protocol';
export declare const convertAnthropicUsage: (messageEvent: Anthropic.MessageStreamEvent, streamContextUsage?: ModelUsage, payload?: ChatPayloadForTransformStream) => ModelUsage | undefined;
//# sourceMappingURL=anthropic.d.ts.map