/**
 * Chat completion parameter configuration
 */
interface ParameterConfig {
    /**
     * Frequency penalty (reduces repetition)
     */
    frequency_penalty?: number;
    /**
     * Maximum tokens to generate
     */
    max_tokens?: number;
    /**
     * Presence penalty (reduces topic repetition)
     */
    presence_penalty?: number;
    /**
     * Temperature value (0-2 range, controls randomness)
     */
    temperature?: number;
    /**
     * Top P value (0-1 range, nucleus sampling)
     */
    top_p?: number;
}
/**
 * Range constraint for a numeric parameter
 */
interface RangeConstraint {
    max?: number;
    min?: number;
}
/**
 * Parameter resolver options for model-specific constraints
 */
interface ParameterResolverOptions {
    /**
     * Frequency penalty range constraints
     */
    frequencyPenaltyRange?: RangeConstraint;
    /**
     * Whether the model has a conflict between temperature and top_p
     * If true, only one parameter can be set
     * @default false
     */
    hasConflict?: boolean;
    /**
     * Max tokens range constraints
     */
    maxTokensRange?: RangeConstraint;
    /**
     * Whether to normalize temperature (divide by 2)
     * @default true
     */
    normalizeTemperature?: boolean;
    /**
     * Whether to prefer temperature over top_p when both are set and there's a conflict
     * @default true
     */
    preferTemperature?: boolean;
    /**
     * Presence penalty range constraints
     */
    presencePenaltyRange?: RangeConstraint;
    /**
     * Temperature value range constraints
     */
    temperatureRange?: RangeConstraint;
    /**
     * Top P value range constraints
     */
    topPRange?: RangeConstraint;
}
/**
 * Resolved parameters ready for API calls
 */
interface ResolvedParameters {
    frequency_penalty?: number;
    max_tokens?: number;
    presence_penalty?: number;
    temperature?: number;
    top_p?: number;
}
/**
 * Resolves and normalizes chat completion parameters based on model constraints
 *
 * This is a core utility for handling model-specific parameter requirements:
 * - Parameter conflicts (e.g., Claude 4+ doesn't allow both temperature and top_p)
 * - Value normalization (e.g., temperature / 2 for some models)
 * - Range constraints (e.g., min/max values)
 *
 * @param config - The input parameter values
 * @param options - Resolution options including conflict handling and normalization rules
 * @returns Resolved parameters with only valid values
 *
 * @example
 * // Basic usage with conflict (Claude Opus 4.1)
 * resolveParameters(
 *   { temperature: 1, top_p: 0.9 },
 *   { hasConflict: true, preferTemperature: true }
 * )
 * // Returns: { temperature: 0.5 } // temperature normalized and top_p omitted
 *
 * @example
 * // Without conflict
 * resolveParameters(
 *   { temperature: 1, top_p: 0.9 },
 *   { hasConflict: false }
 * )
 * // Returns: { temperature: 0.5, top_p: 0.9 }
 *
 * @example
 * // With range constraints (Zhipu glm-4-alltools)
 * resolveParameters(
 *   { temperature: 1, top_p: 0.5 },
 *   {
 *     normalizeTemperature: true,
 *     temperatureRange: { min: 0.01, max: 0.99 },
 *     topPRange: { min: 0.01, max: 0.99 }
 *   }
 * )
 * // Returns: { temperature: 0.5, top_p: 0.5 }
 *
 * @example
 * // With multiple parameters (Qwen)
 * resolveParameters(
 *   { temperature: 1.5, top_p: 0.8, presence_penalty: 1.5 },
 *   {
 *     normalizeTemperature: false,
 *     temperatureRange: { min: 0, max: 2 },
 *     topPRange: { min: 0, max: 1 },
 *     presencePenaltyRange: { min: -2, max: 2 }
 *   }
 * )
 * // Returns: { temperature: 1.5, top_p: 0.8, presence_penalty: 1.5 }
 */
export declare const resolveParameters: (config: ParameterConfig, options?: ParameterResolverOptions) => ResolvedParameters;
/**
 * Creates a parameter resolver with predefined model-specific rules
 *
 * @example
 * // Create a resolver for Claude Opus 4.1
 * const claudeOpusResolver = createParameterResolver({
 *   hasConflict: true,
 *   preferTemperature: true,
 *   normalizeTemperature: true
 * });
 *
 * const params = claudeOpusResolver({ temperature: 1, top_p: 0.9 });
 * // Returns: { temperature: 0.5 }
 */
export declare const createParameterResolver: (options: ParameterResolverOptions) => (config: ParameterConfig) => ResolvedParameters;
export {};
//# sourceMappingURL=parameterResolver.d.ts.map