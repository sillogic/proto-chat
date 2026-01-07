import { ModelUsage } from '@lobechat/types';
import { Pricing } from 'model-bank';
import OpenAI from 'openai';
import { ChatPayloadForTransformStream } from '../streams/protocol';
export declare const convertOpenAIUsage: (usage: OpenAI.Completions.CompletionUsage, payload?: ChatPayloadForTransformStream) => ModelUsage;
export declare const convertOpenAIResponseUsage: (usage: OpenAI.Responses.ResponseUsage, payload?: ChatPayloadForTransformStream) => ModelUsage;
export declare const convertOpenAIImageUsage: (usage: OpenAI.Images.ImagesResponse.Usage, pricing?: Pricing) => ModelUsage;
//# sourceMappingURL=openai.d.ts.map