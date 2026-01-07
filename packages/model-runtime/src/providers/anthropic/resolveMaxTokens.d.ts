import type { ChatStreamPayload } from '../../types';
/**
 * Resolve the max_tokens value to align Anthropic and Bedrock behavior.
 * Priority: user input > model-bank default maxOutput > hardcoded fallback (context-window aware).
 */
export declare const resolveMaxTokens: ({ max_tokens, model, thinking, providerModels, }: {
    max_tokens?: number;
    model: string;
    providerModels: {
        id: string;
        maxOutput?: number;
    }[];
    thinking?: ChatStreamPayload["thinking"];
}) => Promise<number>;
//# sourceMappingURL=resolveMaxTokens.d.ts.map