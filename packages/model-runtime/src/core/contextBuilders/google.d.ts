import { Content, FunctionDeclaration, Tool as GoogleFunctionCallTool, Part } from '@google/genai';
import { ChatCompletionTool, OpenAIChatMessage, UserMessageContentPart } from '../../types';
/**
 * Magic thoughtSignature
 * @see https://ai.google.dev/gemini-api/docs/thought-signatures#model-behavior:~:text=context_engineering_is_the_way_to_go
 */
export declare const GEMINI_MAGIC_THOUGHT_SIGNATURE = "context_engineering_is_the_way_to_go";
/**
 * Convert OpenAI content part to Google Part format
 */
export declare const buildGooglePart: (content: UserMessageContentPart) => Promise<Part | undefined>;
/**
 * Convert OpenAI message to Google Content format
 */
export declare const buildGoogleMessage: (message: OpenAIChatMessage, toolCallNameMap?: Map<string, string>) => Promise<Content>;
/**
 * Convert messages from the OpenAI format to Google GenAI SDK format
 */
export declare const buildGoogleMessages: (messages: OpenAIChatMessage[]) => Promise<Content[]>;
/**
 * Convert ChatCompletionTool to Google FunctionDeclaration
 */
export declare const buildGoogleTool: (tool: ChatCompletionTool) => FunctionDeclaration;
/**
 * Build Google function declarations from ChatCompletionTool array
 */
export declare const buildGoogleTools: (tools: ChatCompletionTool[] | undefined) => GoogleFunctionCallTool[] | undefined;
//# sourceMappingURL=google.d.ts.map