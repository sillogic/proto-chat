import OpenAI from 'openai';
import { ChatStreamPayload, OpenAIChatMessage } from '../../types';
export declare const convertMessageContent: (content: OpenAI.ChatCompletionContentPart) => Promise<OpenAI.ChatCompletionContentPart>;
export declare const convertOpenAIMessages: (messages: OpenAI.ChatCompletionMessageParam[]) => Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>;
export declare const convertOpenAIResponseInputs: (messages: OpenAIChatMessage[]) => Promise<OpenAI.Responses.ResponseInputItem[]>;
export declare const pruneReasoningPayload: (payload: ChatStreamPayload) => any;
/**
 * Convert image URL (data URL or HTTP URL) to File object for OpenAI API
 */
export declare const convertImageUrlToFile: (imageUrl: string) => Promise<import("openai/uploads").FileLike>;
//# sourceMappingURL=openai.d.ts.map