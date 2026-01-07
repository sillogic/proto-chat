import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { OpenAIChatMessage, UserMessageContentPart } from '../../types';
export declare const buildAnthropicBlock: (content: UserMessageContentPart) => Promise<Anthropic.ContentBlock | Anthropic.ImageBlockParam | undefined>;
export declare const buildAnthropicMessage: (message: OpenAIChatMessage) => Promise<Anthropic.Messages.MessageParam>;
export declare const buildAnthropicMessages: (oaiMessages: OpenAIChatMessage[], options?: {
    enabledContextCaching?: boolean;
}) => Promise<Anthropic.Messages.MessageParam[]>;
export declare const buildAnthropicTools: (tools?: OpenAI.ChatCompletionTool[], options?: {
    enabledContextCaching?: boolean;
}) => Anthropic.Messages.Tool[] | undefined;
export declare const buildSearchTool: () => Anthropic.WebSearchTool20250305;
//# sourceMappingURL=anthropic.d.ts.map