"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParameterResolver = exports.resolveParameters = void 0;
/**
 * Apply range constraints to a numeric value
 */
const applyRangeConstraint = (value, range) => {
    if (value === undefined || !range)
        return value;
    let result = value;
    if (range.min !== undefined) {
        result = Math.max(range.min, result);
    }
    if (range.max !== undefined) {
        result = Math.min(range.max, result);
    }
    return result;
};
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
const resolveParameters = (config, options = {}) => {
    const { hasConflict = false, preferTemperature = true, normalizeTemperature = true, temperatureRange, topPRange, frequencyPenaltyRange, presencePenaltyRange, maxTokensRange, } = options;
    const { temperature, top_p, frequency_penalty, presence_penalty, max_tokens } = config;
    const result = {};
    // Determine which parameters are provided
    const shouldSetTemperature = temperature !== undefined;
    const shouldSetTopP = top_p !== undefined;
    // Handle temperature and top_p conflict
    if (hasConflict) {
        if (preferTemperature && shouldSetTemperature) {
            // Set temperature only
            let finalTemp = normalizeTemperature && temperature !== undefined ? temperature / 2 : temperature;
            result.temperature = applyRangeConstraint(finalTemp, temperatureRange);
        }
        else if (shouldSetTopP) {
            // Set top_p only
            result.top_p = applyRangeConstraint(top_p, topPRange);
        }
    }
    else {
        // No conflict: set both parameters if provided
        if (shouldSetTemperature) {
            let finalTemp = normalizeTemperature && temperature !== undefined ? temperature / 2 : temperature;
            result.temperature = applyRangeConstraint(finalTemp, temperatureRange);
        }
        if (shouldSetTopP) {
            result.top_p = applyRangeConstraint(top_p, topPRange);
        }
    }
    // Handle other parameters (no conflicts)
    if (frequency_penalty !== undefined) {
        result.frequency_penalty = applyRangeConstraint(frequency_penalty, frequencyPenaltyRange);
    }
    if (presence_penalty !== undefined) {
        result.presence_penalty = applyRangeConstraint(presence_penalty, presencePenaltyRange);
    }
    if (max_tokens !== undefined) {
        result.max_tokens = applyRangeConstraint(max_tokens, maxTokensRange);
    }
    return result;
};
exports.resolveParameters = resolveParameters;
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
const createParameterResolver = (options) => {
    return (config) => {
        return (0, exports.resolveParameters)(config, options);
    };
};
exports.createParameterResolver = createParameterResolver;
//# sourceMappingURL=parameterResolver.js.map