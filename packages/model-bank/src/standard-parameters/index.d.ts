import type { Simplify } from 'type-fest';
import { z } from 'zod';
export declare const MAX_SEED: number;
/**
 * Default aspect ratio, used when the model doesn't support native aspect ratio
 */
export declare const DEFAULT_ASPECT_RATIO = "1:1";
export declare const PRESET_ASPECT_RATIOS: string[];
/**
 * Image generation and processing configuration constants
 */
export declare const IMAGE_GENERATION_CONFIG: {
    /**
     * Maximum cover image size in pixels (longest edge)
     * Used for generating cover images from source images
     */
    readonly COVER_MAX_SIZE: 256;
    /**
     * Maximum thumbnail size in pixels (longest edge)
     * Used for generating thumbnail images from original images
     */
    readonly THUMBNAIL_MAX_SIZE: 512;
};
/**
 * Default dimension constraints for image upload auto-setting
 * Used when model schema doesn't provide min/max values
 */
export declare const DEFAULT_DIMENSION_CONSTRAINTS: {
    readonly MAX_SIZE: 1024;
    readonly MIN_SIZE: 512;
};
export declare const CHAT_MODEL_IMAGE_GENERATION_PARAMS: ModelParamsSchema;
export declare const ModelParamsMetaSchema: z.ZodObject<{
    /**
     * Prompt is the only parameter that every model has
     */
    prompt: z.ZodObject<{
        default: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        description: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodLiteral<"string">>;
    }, "strip", z.ZodTypeAny, {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
    }, {
        default?: string | undefined;
        description?: string | undefined;
        type?: "string" | undefined;
    }>;
    imageUrl: z.ZodOptional<z.ZodObject<{
        default: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodString>;
        maxFileSize: z.ZodOptional<z.ZodNumber>;
        type: z.ZodOptional<z.ZodTuple<[z.ZodLiteral<"string">, z.ZodLiteral<"null">], null>>;
    }, "strip", z.ZodTypeAny, {
        default?: string | null | undefined;
        description?: string | undefined;
        type?: ["string", "null"] | undefined;
        maxFileSize?: number | undefined;
    }, {
        default?: string | null | undefined;
        description?: string | undefined;
        type?: ["string", "null"] | undefined;
        maxFileSize?: number | undefined;
    }>>;
    imageUrls: z.ZodOptional<z.ZodObject<{
        default: z.ZodArray<z.ZodString, "many">;
        description: z.ZodOptional<z.ZodString>;
        maxCount: z.ZodOptional<z.ZodNumber>;
        /**
         * The maximum file size in bytes
         */
        maxFileSize: z.ZodOptional<z.ZodNumber>;
        type: z.ZodOptional<z.ZodLiteral<"array">>;
    }, "strip", z.ZodTypeAny, {
        default: string[];
        description?: string | undefined;
        type?: "array" | undefined;
        maxFileSize?: number | undefined;
        maxCount?: number | undefined;
    }, {
        default: string[];
        description?: string | undefined;
        type?: "array" | undefined;
        maxFileSize?: number | undefined;
        maxCount?: number | undefined;
    }>>;
    width: z.ZodOptional<z.ZodObject<{
        default: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        max: z.ZodNumber;
        min: z.ZodNumber;
        step: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        type: z.ZodOptional<z.ZodLiteral<"number">>;
    }, "strip", z.ZodTypeAny, {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    }, {
        default: number;
        max: number;
        min: number;
        description?: string | undefined;
        type?: "number" | undefined;
        step?: number | undefined;
    }>>;
    /**
     * samplerName is not requires by all i2i providers
     */
    samplerName: z.ZodOptional<z.ZodObject<{
        default: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        type: z.ZodOptional<z.ZodLiteral<"string">>;
    }, "strip", z.ZodTypeAny, {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
        enum?: string[] | undefined;
    }, {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
        enum?: string[] | undefined;
    }>>;
    /**
     * scheduler is not requires by all i2i providers
     */
    scheduler: z.ZodOptional<z.ZodObject<{
        default: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        type: z.ZodOptional<z.ZodLiteral<"string">>;
    }, "strip", z.ZodTypeAny, {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
        enum?: string[] | undefined;
    }, {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
        enum?: string[] | undefined;
    }>>;
    height: z.ZodOptional<z.ZodObject<{
        default: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        max: z.ZodNumber;
        min: z.ZodNumber;
        step: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        type: z.ZodOptional<z.ZodLiteral<"number">>;
    }, "strip", z.ZodTypeAny, {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    }, {
        default: number;
        max: number;
        min: number;
        description?: string | undefined;
        type?: "number" | undefined;
        step?: number | undefined;
    }>>;
    size: z.ZodOptional<z.ZodObject<{
        default: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        enum: z.ZodArray<z.ZodString, "many">;
        type: z.ZodOptional<z.ZodLiteral<"string">>;
    }, "strip", z.ZodTypeAny, {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    }, {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    }>>;
    aspectRatio: z.ZodOptional<z.ZodObject<{
        default: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        enum: z.ZodArray<z.ZodString, "many">;
        type: z.ZodOptional<z.ZodLiteral<"string">>;
    }, "strip", z.ZodTypeAny, {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    }, {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    }>>;
    resolution: z.ZodOptional<z.ZodObject<{
        default: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        enum: z.ZodArray<z.ZodString, "many">;
        type: z.ZodOptional<z.ZodLiteral<"string">>;
    }, "strip", z.ZodTypeAny, {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    }, {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    }>>;
    cfg: z.ZodOptional<z.ZodObject<{
        default: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        max: z.ZodNumber;
        min: z.ZodNumber;
        step: z.ZodNumber;
        type: z.ZodOptional<z.ZodLiteral<"number">>;
    }, "strip", z.ZodTypeAny, {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    }, {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    }>>;
    /**
     * strength/denoise is optional for t2i but must be used for i2i
     */
    strength: z.ZodOptional<z.ZodObject<{
        default: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        max: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        min: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        step: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        type: z.ZodOptional<z.ZodLiteral<"number">>;
    }, "strip", z.ZodTypeAny, {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    }, {
        default: number;
        description?: string | undefined;
        type?: "number" | undefined;
        max?: number | undefined;
        min?: number | undefined;
        step?: number | undefined;
    }>>;
    steps: z.ZodOptional<z.ZodObject<{
        default: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        max: z.ZodNumber;
        min: z.ZodNumber;
        step: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        type: z.ZodOptional<z.ZodLiteral<"number">>;
    }, "strip", z.ZodTypeAny, {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    }, {
        default: number;
        max: number;
        min: number;
        description?: string | undefined;
        type?: "number" | undefined;
        step?: number | undefined;
    }>>;
    quality: z.ZodOptional<z.ZodObject<{
        default: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        enum: z.ZodArray<z.ZodString, "many">;
        type: z.ZodOptional<z.ZodLiteral<"string">>;
    }, "strip", z.ZodTypeAny, {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    }, {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    }>>;
    seed: z.ZodOptional<z.ZodObject<{
        default: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        description: z.ZodOptional<z.ZodString>;
        max: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        min: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        type: z.ZodOptional<z.ZodTuple<[z.ZodLiteral<"number">, z.ZodLiteral<"null">], null>>;
    }, "strip", z.ZodTypeAny, {
        default: number | null;
        max: number;
        min: number;
        description?: string | undefined;
        type?: ["number", "null"] | undefined;
    }, {
        default?: number | null | undefined;
        description?: string | undefined;
        type?: ["number", "null"] | undefined;
        max?: number | undefined;
        min?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    prompt: {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
    };
    size?: {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    } | undefined;
    imageUrl?: {
        default?: string | null | undefined;
        description?: string | undefined;
        type?: ["string", "null"] | undefined;
        maxFileSize?: number | undefined;
    } | undefined;
    imageUrls?: {
        default: string[];
        description?: string | undefined;
        type?: "array" | undefined;
        maxFileSize?: number | undefined;
        maxCount?: number | undefined;
    } | undefined;
    width?: {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    } | undefined;
    samplerName?: {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
        enum?: string[] | undefined;
    } | undefined;
    scheduler?: {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
        enum?: string[] | undefined;
    } | undefined;
    height?: {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    } | undefined;
    aspectRatio?: {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    } | undefined;
    resolution?: {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    } | undefined;
    cfg?: {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    } | undefined;
    strength?: {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    } | undefined;
    steps?: {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    } | undefined;
    quality?: {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    } | undefined;
    seed?: {
        default: number | null;
        max: number;
        min: number;
        description?: string | undefined;
        type?: ["number", "null"] | undefined;
    } | undefined;
}, {
    prompt: {
        default?: string | undefined;
        description?: string | undefined;
        type?: "string" | undefined;
    };
    size?: {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    } | undefined;
    imageUrl?: {
        default?: string | null | undefined;
        description?: string | undefined;
        type?: ["string", "null"] | undefined;
        maxFileSize?: number | undefined;
    } | undefined;
    imageUrls?: {
        default: string[];
        description?: string | undefined;
        type?: "array" | undefined;
        maxFileSize?: number | undefined;
        maxCount?: number | undefined;
    } | undefined;
    width?: {
        default: number;
        max: number;
        min: number;
        description?: string | undefined;
        type?: "number" | undefined;
        step?: number | undefined;
    } | undefined;
    samplerName?: {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
        enum?: string[] | undefined;
    } | undefined;
    scheduler?: {
        default: string;
        description?: string | undefined;
        type?: "string" | undefined;
        enum?: string[] | undefined;
    } | undefined;
    height?: {
        default: number;
        max: number;
        min: number;
        description?: string | undefined;
        type?: "number" | undefined;
        step?: number | undefined;
    } | undefined;
    aspectRatio?: {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    } | undefined;
    resolution?: {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    } | undefined;
    cfg?: {
        default: number;
        max: number;
        min: number;
        step: number;
        description?: string | undefined;
        type?: "number" | undefined;
    } | undefined;
    strength?: {
        default: number;
        description?: string | undefined;
        type?: "number" | undefined;
        max?: number | undefined;
        min?: number | undefined;
        step?: number | undefined;
    } | undefined;
    steps?: {
        default: number;
        max: number;
        min: number;
        description?: string | undefined;
        type?: "number" | undefined;
        step?: number | undefined;
    } | undefined;
    quality?: {
        default: string;
        enum: string[];
        description?: string | undefined;
        type?: "string" | undefined;
    } | undefined;
    seed?: {
        default?: number | null | undefined;
        description?: string | undefined;
        type?: ["number", "null"] | undefined;
        max?: number | undefined;
        min?: number | undefined;
    } | undefined;
}>;
export type ModelParamsSchema = z.input<typeof ModelParamsMetaSchema>;
export type ModelParamsOutputSchema = z.output<typeof ModelParamsMetaSchema>;
export type ModelParamsKeys = Simplify<keyof ModelParamsOutputSchema>;
type TypeMapping<T> = T extends 'string' ? string : T extends 'number' ? number : T extends ['number', 'null'] ? number | null : T extends ['string', 'null'] ? string | null : T extends 'string' ? string : T extends 'boolean' ? boolean : never;
type TypeType<K extends ModelParamsKeys> = NonNullable<ModelParamsOutputSchema[K]>['type'];
type DefaultType<K extends ModelParamsKeys> = NonNullable<ModelParamsOutputSchema[K]>['default'];
type _StandardImageGenerationParameters<P extends ModelParamsKeys = ModelParamsKeys> = {
    [key in P]: NonNullable<TypeType<key>> extends 'array' ? DefaultType<key> : TypeMapping<TypeType<key>>;
};
export type RuntimeImageGenParams = Pick<_StandardImageGenerationParameters, 'prompt'> & Partial<Omit<_StandardImageGenerationParameters, 'prompt'>>;
export type RuntimeImageGenParamsKeys = keyof RuntimeImageGenParams;
export type RuntimeImageGenParamsValue = RuntimeImageGenParams[RuntimeImageGenParamsKeys];
export declare function validateModelParamsSchema(paramsSchema: unknown): ModelParamsOutputSchema;
/**
 * Extract default values from parameter definition object
 */
export declare function extractDefaultValues(paramsSchema: ModelParamsSchema): RuntimeImageGenParams;
export {};
//# sourceMappingURL=index.d.ts.map