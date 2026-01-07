"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCacheTTL = void 0;
const DEFAULT_CACHE_TTL = '5m';
/**
 * Resolves cache TTL from Anthropic payload or request settings.
 * Returns the first valid TTL found in system messages or content blocks.
 */
const resolveCacheTTL = (requestPayload, anthropicPayload) => {
    // Check system messages for cache TTL
    if (Array.isArray(anthropicPayload.system)) {
        for (const block of anthropicPayload.system) {
            const ttl = block.cache_control?.ttl;
            if (ttl)
                return ttl;
        }
    }
    // Check message content blocks for cache TTL
    for (const message of anthropicPayload.messages ?? []) {
        if (!Array.isArray(message.content))
            continue;
        for (const block of message.content) {
            const ttl = ('cache_control' in block && block.cache_control?.ttl);
            if (ttl)
                return ttl;
        }
    }
    // Use default TTL if context caching is enabled
    if (requestPayload.enabledContextCaching) {
        return DEFAULT_CACHE_TTL;
    }
    return undefined;
};
exports.resolveCacheTTL = resolveCacheTTL;
//# sourceMappingURL=resolveCacheTTL.js.map