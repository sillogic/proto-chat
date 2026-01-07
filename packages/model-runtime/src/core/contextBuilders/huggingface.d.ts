import type { OpenAIChatMessage } from '../../types';
/**
 * Converts OpenAI-style chat messages to Hugging Face chat completion format.
 *
 * @param messages - Array of OpenAI chat messages
 * @returns Array of messages compatible with HuggingFace ChatCompletionInput
 */
export declare function convertOpenAIMessagesToHFFormat(messages: OpenAIChatMessage[]): Array<{
    content?: string | Array<{
        text: string;
        type: 'text';
    } | {
        image_url: {
            detail?: 'auto' | 'low' | 'high';
            url: string;
        };
        type: 'image_url';
    }>;
    name?: string;
    role: string;
    tool_call_id?: string;
    tool_calls?: Array<{
        function: {
            arguments?: string;
            name: string;
        };
        id: string;
        type: string;
    }>;
}>;
//# sourceMappingURL=huggingface.d.ts.map