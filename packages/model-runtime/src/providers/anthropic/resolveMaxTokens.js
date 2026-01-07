"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMaxTokens = void 0;
const smallContextWindowPatterns = [
    /claude-3-opus-20240229/,
    /claude-3-haiku-20240307/,
    /claude-v2(:1)?$/,
];
/**
 * Resolve the max_tokens value to align Anthropic and Bedrock behavior.
 * Priority: user input > model-bank default maxOutput > hardcoded fallback (context-window aware).
 */
const resolveMaxTokens = async ({ max_tokens, model, thinking, providerModels, }) => {
    const defaultMaxOutput = providerModels.find((m) => m.id === model)?.maxOutput;
    const preferredMaxTokens = max_tokens ?? defaultMaxOutput;
    if (preferredMaxTokens)
        return preferredMaxTokens;
    if (thinking?.type === 'enabled')
        return 32000;
    const hasSmallContextWindow = smallContextWindowPatterns.some((pattern) => pattern.test(model));
    return hasSmallContextWindow ? 4096 : 8192;
};
exports.resolveMaxTokens = resolveMaxTokens;
//# sourceMappingURL=resolveMaxTokens.js.map