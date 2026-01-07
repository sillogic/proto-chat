import { GoogleGenAI } from '@google/genai';
import { ChatCompletionTool, GenerateObjectOptions, GenerateObjectSchema } from '../../types';
/**
 * Convert OpenAI JSON schema to Google Gemini schema format
 */
export declare const convertOpenAISchemaToGoogleSchema: (openAISchema: GenerateObjectSchema) => any;
/**
 * Generate structured output using Google Gemini API
 * @see https://ai.google.dev/gemini-api/docs/structured-output
 */
export declare const createGoogleGenerateObject: (client: GoogleGenAI, payload: {
    contents: any[];
    model: string;
    schema: GenerateObjectSchema;
}, options?: GenerateObjectOptions) => Promise<any>;
/**
 * Generate structured output using Google Gemini API with tools calling
 * @see https://ai.google.dev/gemini-api/docs/function-calling
 */
export declare const createGoogleGenerateObjectWithTools: (client: GoogleGenAI, payload: {
    contents: any[];
    model: string;
    tools: ChatCompletionTool[];
}, options?: GenerateObjectOptions) => Promise<{
    arguments: Record<string, unknown> | undefined;
    name: string | undefined;
}[] | undefined>;
//# sourceMappingURL=generateObject.d.ts.map