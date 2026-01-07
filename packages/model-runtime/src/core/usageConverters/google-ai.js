"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertGoogleAIUsage = void 0;
const genai_1 = require("@google/genai");
const withUsageCost_1 = require("./utils/withUsageCost");
const getTokenCount = (details, modality) => {
    return details?.find((detail) => detail?.modality === modality)?.tokenCount;
};
const convertGoogleAIUsage = (usage, pricing) => {
    const inputCacheMissTokens = usage.promptTokenCount && usage.cachedContentTokenCount
        ? usage.promptTokenCount - usage.cachedContentTokenCount
        : undefined;
    const reasoningTokens = usage.thoughtsTokenCount;
    const candidatesDetails = usage.candidatesTokensDetails;
    const totalCandidatesTokens = usage.candidatesTokenCount ??
        candidatesDetails?.reduce((sum, detail) => sum + (detail?.tokenCount ?? 0), 0) ??
        0;
    const outputImageTokens = getTokenCount(candidatesDetails, genai_1.MediaModality.IMAGE) ?? 0;
    const textTokensFromDetails = getTokenCount(candidatesDetails, genai_1.MediaModality.TEXT);
    const outputTextTokens = typeof textTokensFromDetails === 'number' && textTokensFromDetails > 0
        ? textTokensFromDetails
        : Math.max(0, totalCandidatesTokens - outputImageTokens);
    const totalOutputTokens = totalCandidatesTokens + (reasoningTokens ?? 0);
    const normalizedUsage = {
        inputAudioTokens: getTokenCount(usage.promptTokensDetails, genai_1.MediaModality.AUDIO),
        inputCacheMissTokens,
        inputCachedTokens: usage.cachedContentTokenCount,
        inputImageTokens: getTokenCount(usage.promptTokensDetails, genai_1.MediaModality.IMAGE),
        inputTextTokens: getTokenCount(usage.promptTokensDetails, genai_1.MediaModality.TEXT),
        outputImageTokens,
        outputReasoningTokens: reasoningTokens,
        outputTextTokens,
        totalInputTokens: usage.promptTokenCount,
        totalOutputTokens,
        totalTokens: usage.totalTokenCount,
    };
    return (0, withUsageCost_1.withUsageCost)(normalizedUsage, pricing);
};
exports.convertGoogleAIUsage = convertGoogleAIUsage;
//# sourceMappingURL=google-ai.js.map