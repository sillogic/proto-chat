"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelParamsMetaSchema = exports.CHAT_MODEL_IMAGE_GENERATION_PARAMS = exports.DEFAULT_DIMENSION_CONSTRAINTS = exports.IMAGE_GENERATION_CONFIG = exports.PRESET_ASPECT_RATIOS = exports.DEFAULT_ASPECT_RATIO = exports.MAX_SEED = void 0;
exports.validateModelParamsSchema = validateModelParamsSchema;
exports.extractDefaultValues = extractDefaultValues;
const zod_1 = require("zod");
exports.MAX_SEED = 2 ** 31 - 1;
/**
 * Default aspect ratio, used when the model doesn't support native aspect ratio
 */
exports.DEFAULT_ASPECT_RATIO = '1:1';
exports.PRESET_ASPECT_RATIOS = [
    exports.DEFAULT_ASPECT_RATIO, // '1:1' - Square, most commonly used
    '16:9', // Modern monitors/TVs/video standard
    '9:16', // Mobile portrait/short videos
    '4:3', // Traditional monitors/photos
    '3:4', // Traditional portrait photos
    '3:2', // Classic photo ratio landscape
    '2:3', // Classic photo ratio portrait
];
/**
 * Image generation and processing configuration constants
 */
exports.IMAGE_GENERATION_CONFIG = {
    /**
     * Maximum cover image size in pixels (longest edge)
     * Used for generating cover images from source images
     */
    COVER_MAX_SIZE: 256,
    /**
     * Maximum thumbnail size in pixels (longest edge)
     * Used for generating thumbnail images from original images
     */
    THUMBNAIL_MAX_SIZE: 512,
};
/**
 * Default dimension constraints for image upload auto-setting
 * Used when model schema doesn't provide min/max values
 */
exports.DEFAULT_DIMENSION_CONSTRAINTS = {
    MAX_SIZE: 1024,
    MIN_SIZE: 512,
};
exports.CHAT_MODEL_IMAGE_GENERATION_PARAMS = {
    imageUrls: {
        default: [],
    },
    prompt: { default: '' },
};
// Define top-level meta specification - flat structure
exports.ModelParamsMetaSchema = zod_1.z.object({
    /**
     * Prompt is the only parameter that every model has
     */
    prompt: zod_1.z.object({
        default: zod_1.z.string().optional().default(''),
        description: zod_1.z.string().optional(),
        type: zod_1.z.literal('string').optional(),
    }),
    imageUrl: zod_1.z
        .object({
        default: zod_1.z.string().nullable().optional(),
        description: zod_1.z.string().optional(),
        maxFileSize: zod_1.z.number().optional(),
        type: zod_1.z.tuple([zod_1.z.literal('string'), zod_1.z.literal('null')]).optional(),
    })
        .optional(),
    imageUrls: zod_1.z
        .object({
        default: zod_1.z.array(zod_1.z.string()),
        description: zod_1.z.string().optional(),
        maxCount: zod_1.z.number().optional(),
        /**
         * The maximum file size in bytes
         */
        maxFileSize: zod_1.z.number().optional(),
        type: zod_1.z.literal('array').optional(),
    })
        .optional(),
    width: zod_1.z
        .object({
        default: zod_1.z.number(),
        description: zod_1.z.string().optional(),
        max: zod_1.z.number(),
        min: zod_1.z.number(),
        step: zod_1.z.number().optional().default(1),
        type: zod_1.z.literal('number').optional(),
    })
        .optional(),
    /**
     * samplerName is not requires by all i2i providers
     */
    samplerName: zod_1.z
        .object({
        default: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        enum: zod_1.z.array(zod_1.z.string()).optional(),
        type: zod_1.z.literal('string').optional(),
    })
        .optional(),
    /**
     * scheduler is not requires by all i2i providers
     */
    scheduler: zod_1.z
        .object({
        default: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        enum: zod_1.z.array(zod_1.z.string()).optional(),
        type: zod_1.z.literal('string').optional(),
    })
        .optional(),
    height: zod_1.z
        .object({
        default: zod_1.z.number(),
        description: zod_1.z.string().optional(),
        max: zod_1.z.number(),
        min: zod_1.z.number(),
        step: zod_1.z.number().optional().default(1),
        type: zod_1.z.literal('number').optional(),
    })
        .optional(),
    size: zod_1.z
        .object({
        default: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        enum: zod_1.z.array(zod_1.z.string()),
        type: zod_1.z.literal('string').optional(),
    })
        .optional(),
    aspectRatio: zod_1.z
        .object({
        default: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        enum: zod_1.z.array(zod_1.z.string()),
        type: zod_1.z.literal('string').optional(),
    })
        .optional(),
    resolution: zod_1.z
        .object({
        default: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        enum: zod_1.z.array(zod_1.z.string()),
        type: zod_1.z.literal('string').optional(),
    })
        .optional(),
    cfg: zod_1.z
        .object({
        default: zod_1.z.number(),
        description: zod_1.z.string().optional(),
        max: zod_1.z.number(),
        min: zod_1.z.number(),
        step: zod_1.z.number(),
        type: zod_1.z.literal('number').optional(),
    })
        .optional(),
    /**
     * strength/denoise is optional for t2i but must be used for i2i
     */
    strength: zod_1.z
        .object({
        default: zod_1.z.number(),
        description: zod_1.z.string().optional(),
        max: zod_1.z.number().optional().default(1),
        min: zod_1.z.number().optional().default(0),
        step: zod_1.z.number().optional().default(0.05),
        type: zod_1.z.literal('number').optional(),
    })
        .optional(),
    steps: zod_1.z
        .object({
        default: zod_1.z.number(),
        description: zod_1.z.string().optional(),
        max: zod_1.z.number(),
        min: zod_1.z.number(),
        step: zod_1.z.number().optional().default(1),
        type: zod_1.z.literal('number').optional(),
    })
        .optional(),
    quality: zod_1.z
        .object({
        default: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        enum: zod_1.z.array(zod_1.z.string()),
        type: zod_1.z.literal('string').optional(),
    })
        .optional(),
    seed: zod_1.z
        .object({
        default: zod_1.z.number().nullable().default(null),
        description: zod_1.z.string().optional(),
        max: zod_1.z.number().optional().default(exports.MAX_SEED),
        min: zod_1.z.number().optional().default(0),
        type: zod_1.z.tuple([zod_1.z.literal('number'), zod_1.z.literal('null')]).optional(),
    })
        .optional(),
});
// Validation function
function validateModelParamsSchema(paramsSchema) {
    return exports.ModelParamsMetaSchema.parse(paramsSchema);
}
/**
 * Extract default values from parameter definition object
 */
function extractDefaultValues(paramsSchema) {
    // Some default values are obtained from ModelParamsMetaSchema
    const schemaWithDefault = exports.ModelParamsMetaSchema.parse(paramsSchema);
    return Object.fromEntries(Object.entries(schemaWithDefault).map(([key, value]) => {
        return [key, value.default];
    }));
}
//# sourceMappingURL=index.js.map