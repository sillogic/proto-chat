import Anthropic from '@anthropic-ai/sdk';
import { ChatStreamPayload } from '../../types';
type CacheTTL = Anthropic.Messages.CacheControlEphemeral['ttl'];
/**
 * Resolves cache TTL from Anthropic payload or request settings.
 * Returns the first valid TTL found in system messages or content blocks.
 */
export declare const resolveCacheTTL: (requestPayload: ChatStreamPayload, anthropicPayload: {
    messages: Anthropic.MessageCreateParams["messages"];
    system: Anthropic.MessageCreateParams["system"];
}) => CacheTTL | undefined;
export {};
//# sourceMappingURL=resolveCacheTTL.d.ts.map