"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertAnthropicUsage = void 0;
const withUsageCost_1 = require("./utils/withUsageCost");
const buildInitialUsage = (usage) => {
    if (!usage)
        return undefined;
    let totalInputTokens = usage.input_tokens;
    if (usage.cache_creation_input_tokens || usage.cache_read_input_tokens) {
        totalInputTokens =
            (usage.input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0) +
                (usage.cache_read_input_tokens || 0);
    }
    return {
        inputCacheMissTokens: usage.input_tokens,
        inputCachedTokens: usage.cache_read_input_tokens || undefined,
        inputWriteCacheTokens: usage.cache_creation_input_tokens || undefined,
        totalInputTokens,
        totalOutputTokens: usage.output_tokens,
    };
};
const mergeDeltaUsage = (previousUsage, usage) => {
    const deltaOutputTokens = usage?.output_tokens || 0;
    if (!previousUsage && deltaOutputTokens === 0) {
        return undefined;
    }
    const base = previousUsage ? { ...previousUsage } : {};
    const totalOutputTokens = (previousUsage?.totalOutputTokens || 0) + deltaOutputTokens;
    const totalInputTokens = previousUsage?.totalInputTokens || 0;
    const totalTokens = totalInputTokens + totalOutputTokens;
    base.totalInputTokens = totalInputTokens;
    base.totalOutputTokens = totalOutputTokens;
    if (totalTokens > 0) {
        base.totalTokens = totalTokens;
    }
    return base;
};
const convertAnthropicUsage = (messageEvent, streamContextUsage, payload) => {
    switch (messageEvent.type) {
        case 'message_start': {
            return buildInitialUsage(messageEvent.message.usage);
        }
        case 'message_delta': {
            const usage = mergeDeltaUsage(streamContextUsage, messageEvent.usage);
            return usage && (0, withUsageCost_1.withUsageCost)(usage, payload?.pricing, payload?.pricingOptions);
        }
        default: {
            return streamContextUsage;
        }
    }
};
exports.convertAnthropicUsage = convertAnthropicUsage;
//# sourceMappingURL=anthropic.js.map