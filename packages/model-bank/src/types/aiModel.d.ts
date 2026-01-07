import { z } from 'zod';
import { ModelParamsSchema } from '../standard-parameters';
export type ModelPriceCurrency = 'CNY' | 'USD';
export declare const AiModelSourceEnum: {
    readonly Builtin: "builtin";
    readonly Custom: "custom";
    readonly Remote: "remote";
};
export type AiModelSourceType = (typeof AiModelSourceEnum)[keyof typeof AiModelSourceEnum];
export declare const AiModelTypeSchema: z.ZodEnum<["chat", "embedding", "tts", "stt", "image", "text2video", "text2music", "realtime"]>;
export type AiModelType = z.infer<typeof AiModelTypeSchema>;
export interface ModelAbilities {
    /**
     * whether model supports file upload
     */
    files?: boolean;
    /**
     * whether model supports function call
     */
    functionCall?: boolean;
    /**
     * whether model supports image output
     */
    imageOutput?: boolean;
    /**
     * whether model supports reasoning
     */
    reasoning?: boolean;
    /**
     * whether model supports search web
     */
    search?: boolean;
    /**
     * whether model supports structured output
     */
    structuredOutput?: boolean;
    /**
     * whether model supports video
     */
    video?: boolean;
    /**
     *  whether model supports vision
     */
    vision?: boolean;
}
export interface LLMParams {
    /**
     * Controls the penalty coefficient in generated text to reduce repetition
     * @default 0
     */
    frequency_penalty?: number;
    /**
     * Maximum length of generated text
     */
    max_tokens?: number;
    /**
     * Controls the penalty coefficient in generated text to reduce topic variation
     * @default 0
     */
    presence_penalty?: number;
    /**
     * Random measure for generated text to control creativity and diversity
     * @default 1
     */
    reasoning_effort?: string;
    /**
     * Random measure for generated text to control creativity and diversity
     * @default 1
     */
    temperature?: number;
    /**
     * Controls the single token with highest probability in generated text
     * @default 1
     */
    top_p?: number;
}
export interface BasicModelPricing {
    /**
     * the currency of the pricing
     * @default USD
     */
    currency?: ModelPriceCurrency;
    /**
     * the input pricing, e.g. $1 / 1M tokens
     */
    input?: number;
}
export interface ChatModelPricing extends BasicModelPricing {
    audioInput?: number;
    audioOutput?: number;
    cachedAudioInput?: number;
    cachedInput?: number;
    /**
     * the output pricing, e.g. $2 / 1M tokens
     */
    output?: number;
    writeCacheInput?: number;
}
export type PricingUnitName = 'textInput' | 'textOutput' | 'textInput_cacheRead' | 'textInput_cacheWrite' | 'audioInput' | 'audioOutput' | 'audioInput_cacheRead' | 'imageGeneration' | 'imageInput' | 'imageInput_cacheRead' | 'imageOutput';
export type PricingUnitType = 'millionTokens' | 'millionCharacters' | 'image' | 'megapixel' | 'second';
export type PricingStrategy = 'fixed' | 'tiered' | 'lookup';
export interface PricingUnitBase {
    name: PricingUnitName;
    strategy: PricingStrategy;
    unit: PricingUnitType;
}
export interface FixedPricingUnit extends PricingUnitBase {
    rate: number;
    strategy: 'fixed';
}
export interface TieredPricingUnit extends PricingUnitBase {
    strategy: 'tiered';
    tiers: Array<{
        rate: number;
        upTo: number | 'infinity';
    }>;
}
export interface LookupPricingUnit extends PricingUnitBase {
    lookup: {
        prices: Record<string, number>;
        pricingParams: string[];
    };
    strategy: 'lookup';
}
export type PricingUnit = FixedPricingUnit | TieredPricingUnit | LookupPricingUnit;
export interface Pricing {
    /**
     * Fallback approximate per-image price (USD) when detailed pricing table is unavailable
     */
    approximatePricePerImage?: number;
    currency?: ModelPriceCurrency;
    units: PricingUnit[];
}
export interface AIBaseModelCard {
    /**
     * the context window (or input + output tokens limit)
     */
    contextWindowTokens?: number;
    description?: string;
    /**
     * the name show for end user
     */
    displayName?: string;
    enabled?: boolean;
    id: string;
    /**
     * whether model is legacy (deprecated but not removed yet)
     */
    legacy?: boolean;
    maxOutput?: number;
    /**
     * who create this model
     */
    organization?: string;
    releasedAt?: string;
}
export interface AiModelConfig {
    /**
     * used in azure and volcengine
     */
    deploymentName?: string;
    /**
     * qwen series model enabled search
     */
    enabledSearch?: boolean;
}
export type ModelSearchImplementType = 'tool' | 'params' | 'internal';
export type ExtendParamsType = 'reasoningBudgetToken' | 'enableReasoning' | 'disableContextCaching' | 'reasoningEffort' | 'gpt5ReasoningEffort' | 'gpt5_1ReasoningEffort' | 'textVerbosity' | 'thinking' | 'thinkingBudget' | 'thinkingLevel' | 'imageAspectRatio' | 'imageResolution' | 'urlContext';
export interface AiModelSettings {
    extendParams?: ExtendParamsType[];
    /**
     * How the model layer implements search
     */
    searchImpl?: ModelSearchImplementType;
    searchProvider?: string;
}
export interface AIChatModelCard extends AIBaseModelCard {
    abilities?: ModelAbilities;
    config?: AiModelConfig;
    maxOutput?: number;
    pricing?: Pricing;
    settings?: AiModelSettings;
    type: 'chat';
}
export interface AIEmbeddingModelCard extends AIBaseModelCard {
    maxDimension: number;
    pricing?: Pricing;
    type: 'embedding';
}
export interface AIImageModelCard extends AIBaseModelCard {
    parameters?: ModelParamsSchema;
    pricing?: Pricing;
    resolutions?: string[];
    type: 'image';
}
export interface AITTSModelCard extends AIBaseModelCard {
    pricing?: Pricing;
    type: 'tts';
}
export interface AISTTModelCard extends AIBaseModelCard {
    pricing?: Pricing;
    type: 'stt';
}
export interface AIRealtimeModelCard extends AIBaseModelCard {
    abilities?: {
        /**
         * whether model supports file upload
         */
        files?: boolean;
        /**
         * whether model supports function call
         */
        functionCall?: boolean;
        /**
         *  whether model supports reasoning
         */
        reasoning?: boolean;
        /**
         *  whether model supports vision
         */
        vision?: boolean;
    };
    /**
     * used in azure and volcengine
     */
    deploymentName?: string;
    maxOutput?: number;
    pricing?: Pricing;
    type: 'realtime';
}
export interface AiFullModelCard extends AIBaseModelCard {
    abilities?: ModelAbilities;
    config?: AiModelConfig;
    contextWindowTokens?: number;
    displayName?: string;
    id: string;
    maxDimension?: number;
    parameters?: ModelParamsSchema;
    pricing?: Pricing;
    type: AiModelType;
}
export interface LobeDefaultAiModelListItem extends AiFullModelCard {
    abilities: ModelAbilities;
    providerId: string;
}
export declare const CreateAiModelSchema: z.ZodObject<{
    abilities: z.ZodOptional<z.ZodObject<{
        functionCall: z.ZodOptional<z.ZodBoolean>;
        imageOutput: z.ZodOptional<z.ZodBoolean>;
        reasoning: z.ZodOptional<z.ZodBoolean>;
        search: z.ZodOptional<z.ZodBoolean>;
        video: z.ZodOptional<z.ZodBoolean>;
        vision: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        search?: boolean | undefined;
        functionCall?: boolean | undefined;
        imageOutput?: boolean | undefined;
        reasoning?: boolean | undefined;
        video?: boolean | undefined;
        vision?: boolean | undefined;
    }, {
        search?: boolean | undefined;
        functionCall?: boolean | undefined;
        imageOutput?: boolean | undefined;
        reasoning?: boolean | undefined;
        video?: boolean | undefined;
        vision?: boolean | undefined;
    }>>;
    contextWindowTokens: z.ZodOptional<z.ZodNumber>;
    displayName: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    providerId: z.ZodString;
    releasedAt: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["chat", "embedding", "tts", "stt", "image", "text2video", "text2music", "realtime"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    providerId: string;
    type?: "chat" | "embedding" | "tts" | "stt" | "image" | "text2video" | "text2music" | "realtime" | undefined;
    displayName?: string | undefined;
    abilities?: {
        search?: boolean | undefined;
        functionCall?: boolean | undefined;
        imageOutput?: boolean | undefined;
        reasoning?: boolean | undefined;
        video?: boolean | undefined;
        vision?: boolean | undefined;
    } | undefined;
    contextWindowTokens?: number | undefined;
    releasedAt?: string | undefined;
}, {
    id: string;
    providerId: string;
    type?: "chat" | "embedding" | "tts" | "stt" | "image" | "text2video" | "text2music" | "realtime" | undefined;
    displayName?: string | undefined;
    abilities?: {
        search?: boolean | undefined;
        functionCall?: boolean | undefined;
        imageOutput?: boolean | undefined;
        reasoning?: boolean | undefined;
        video?: boolean | undefined;
        vision?: boolean | undefined;
    } | undefined;
    contextWindowTokens?: number | undefined;
    releasedAt?: string | undefined;
}>;
export type CreateAiModelParams = z.infer<typeof CreateAiModelSchema>;
export interface AiProviderModelListItem {
    abilities?: ModelAbilities;
    config?: AiModelConfig;
    contextWindowTokens?: number;
    displayName?: string;
    enabled: boolean;
    id: string;
    parameters?: ModelParamsSchema;
    pricing?: Pricing;
    releasedAt?: string;
    settings?: AiModelSettings;
    source?: AiModelSourceType;
    type: AiModelType;
}
export declare const UpdateAiModelSchema: z.ZodObject<{
    abilities: z.ZodOptional<z.ZodObject<{
        functionCall: z.ZodOptional<z.ZodBoolean>;
        imageOutput: z.ZodOptional<z.ZodBoolean>;
        reasoning: z.ZodOptional<z.ZodBoolean>;
        search: z.ZodOptional<z.ZodBoolean>;
        video: z.ZodOptional<z.ZodBoolean>;
        vision: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        search?: boolean | undefined;
        functionCall?: boolean | undefined;
        imageOutput?: boolean | undefined;
        reasoning?: boolean | undefined;
        video?: boolean | undefined;
        vision?: boolean | undefined;
    }, {
        search?: boolean | undefined;
        functionCall?: boolean | undefined;
        imageOutput?: boolean | undefined;
        reasoning?: boolean | undefined;
        video?: boolean | undefined;
        vision?: boolean | undefined;
    }>>;
    config: z.ZodOptional<z.ZodObject<{
        deploymentName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        deploymentName?: string | undefined;
    }, {
        deploymentName?: string | undefined;
    }>>;
    contextWindowTokens: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodOptional<z.ZodEnum<["chat", "embedding", "tts", "stt", "image", "text2video", "text2music", "realtime"]>>;
}, "strip", z.ZodTypeAny, {
    config?: {
        deploymentName?: string | undefined;
    } | undefined;
    type?: "chat" | "embedding" | "tts" | "stt" | "image" | "text2video" | "text2music" | "realtime" | undefined;
    displayName?: string | null | undefined;
    abilities?: {
        search?: boolean | undefined;
        functionCall?: boolean | undefined;
        imageOutput?: boolean | undefined;
        reasoning?: boolean | undefined;
        video?: boolean | undefined;
        vision?: boolean | undefined;
    } | undefined;
    contextWindowTokens?: number | null | undefined;
}, {
    config?: {
        deploymentName?: string | undefined;
    } | undefined;
    type?: "chat" | "embedding" | "tts" | "stt" | "image" | "text2video" | "text2music" | "realtime" | undefined;
    displayName?: string | null | undefined;
    abilities?: {
        search?: boolean | undefined;
        functionCall?: boolean | undefined;
        imageOutput?: boolean | undefined;
        reasoning?: boolean | undefined;
        video?: boolean | undefined;
        vision?: boolean | undefined;
    } | undefined;
    contextWindowTokens?: number | null | undefined;
}>;
export type UpdateAiModelParams = z.infer<typeof UpdateAiModelSchema>;
export interface AiModelSortMap {
    id: string;
    sort: number;
    type?: AiModelType;
}
export declare const ToggleAiModelEnableSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    id: z.ZodString;
    providerId: z.ZodString;
    source: z.ZodOptional<z.ZodEnum<["builtin", "custom", "remote"]>>;
    type: z.ZodOptional<z.ZodEnum<["chat", "embedding", "tts", "stt", "image", "text2video", "text2music", "realtime"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    enabled: boolean;
    providerId: string;
    source?: "custom" | "builtin" | "remote" | undefined;
    type?: "chat" | "embedding" | "tts" | "stt" | "image" | "text2video" | "text2music" | "realtime" | undefined;
}, {
    id: string;
    enabled: boolean;
    providerId: string;
    source?: "custom" | "builtin" | "remote" | undefined;
    type?: "chat" | "embedding" | "tts" | "stt" | "image" | "text2video" | "text2music" | "realtime" | undefined;
}>;
export type ToggleAiModelEnableParams = z.infer<typeof ToggleAiModelEnableSchema>;
export interface AiModelForSelect {
    abilities: ModelAbilities;
    /**
     * Approximate per-image price (USD), used when exact calculation is not possible
     */
    approximatePricePerImage?: number;
    contextWindowTokens?: number;
    description?: string;
    displayName?: string;
    id: string;
    parameters?: ModelParamsSchema;
    /**
     * Exact per-image price (USD) calculated from pricing units
     */
    pricePerImage?: number;
    pricing?: Pricing;
    releasedAt?: string;
}
export interface EnabledAiModel {
    abilities: ModelAbilities;
    config?: AiModelConfig;
    contextWindowTokens?: number;
    displayName?: string;
    enabled?: boolean;
    id: string;
    parameters?: ModelParamsSchema;
    providerId: string;
    releasedAt?: string;
    settings?: AiModelSettings;
    sort?: number;
    type: AiModelType;
}
//# sourceMappingURL=aiModel.d.ts.map