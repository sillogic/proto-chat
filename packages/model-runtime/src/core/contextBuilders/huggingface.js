"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertOpenAIMessagesToHFFormat = convertOpenAIMessagesToHFFormat;
/**
 * Converts OpenAI-style chat messages to Hugging Face chat completion format.
 *
 * @param messages - Array of OpenAI chat messages
 * @returns Array of messages compatible with HuggingFace ChatCompletionInput
 */
function convertOpenAIMessagesToHFFormat(messages) {
    return messages.map((message) => {
        // Handle content conversion: string stays as string, content parts get converted
        let convertedContent;
        if (typeof message.content === 'string') {
            convertedContent = message.content;
        }
        else if (Array.isArray(message.content)) {
            convertedContent = message.content.map((part) => {
                if (part.type === 'text') {
                    return {
                        text: part.text,
                        type: 'text',
                    };
                }
                else if (part.type === 'image_url') {
                    return {
                        image_url: {
                            detail: part.image_url.detail,
                            url: part.image_url.url,
                        },
                        type: 'image_url',
                    };
                }
                // Fallback for unknown content types
                return { text: '', type: 'text' };
            });
        }
        return {
            content: convertedContent,
            name: message.name,
            role: message.role,
            tool_call_id: message.tool_call_id,
            tool_calls: message.tool_calls?.map((tc) => ({
                function: {
                    arguments: tc.function.arguments,
                    name: tc.function.name,
                },
                id: tc.id,
                type: 'function',
            })),
        };
    });
}
//# sourceMappingURL=huggingface.js.map