export declare const systemToUserModels: Set<string>;
export declare const disableStreamModels: Set<string>;
/**
 * models use Responses API only
 */
export declare const responsesAPIModels: Set<string>;
/**
 * Regex patterns for models that support context caching (3.5+)
 */
export declare const contextCachingModelPatterns: RegExp[];
export declare const isContextCachingModel: (model: string) => boolean;
/**
 * Regex patterns for Claude models that support thinking with tools (3.7+)
 */
export declare const thinkingWithToolClaudeModelPatterns: RegExp[];
export declare const isThinkingWithToolClaudeModel: (model: string) => boolean;
/**
 * Regex patterns for Claude 4+ models that have temperature/top_p parameter conflict
 * (cannot set both temperature and top_p at the same time)
 */
export declare const temperatureTopPConflictModelPatterns: RegExp[];
export declare const hasTemperatureTopPConflict: (model: string) => boolean;
//# sourceMappingURL=models.d.ts.map