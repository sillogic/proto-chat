"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToggleAiModelEnableSchema = exports.UpdateAiModelSchema = exports.CreateAiModelSchema = exports.AiModelTypeSchema = exports.AiModelSourceEnum = void 0;
const zod_1 = require("zod");
exports.AiModelSourceEnum = {
    Builtin: 'builtin',
    Custom: 'custom',
    Remote: 'remote',
};
exports.AiModelTypeSchema = zod_1.z.enum([
    'chat',
    'embedding',
    'tts',
    'stt',
    'image',
    'text2video',
    'text2music',
    'realtime',
]);
const AiModelAbilitiesSchema = zod_1.z.object({
    // files: z.boolean().optional(),
    functionCall: zod_1.z.boolean().optional(),
    imageOutput: zod_1.z.boolean().optional(),
    reasoning: zod_1.z.boolean().optional(),
    search: zod_1.z.boolean().optional(),
    video: zod_1.z.boolean().optional(),
    vision: zod_1.z.boolean().optional(),
});
// create
exports.CreateAiModelSchema = zod_1.z.object({
    abilities: AiModelAbilitiesSchema.optional(),
    contextWindowTokens: zod_1.z.number().optional(),
    displayName: zod_1.z.string().optional(),
    id: zod_1.z.string(),
    providerId: zod_1.z.string(),
    releasedAt: zod_1.z.string().optional(),
    type: exports.AiModelTypeSchema.optional(),
    // checkModel: z.string().optional(),
    // homeUrl: z.string().optional(),
    // modelsUrl: z.string().optional(),
});
// Update
exports.UpdateAiModelSchema = zod_1.z.object({
    abilities: AiModelAbilitiesSchema.optional(),
    config: zod_1.z
        .object({
        deploymentName: zod_1.z.string().optional(),
    })
        .optional(),
    contextWindowTokens: zod_1.z.number().nullable().optional(),
    displayName: zod_1.z.string().nullable().optional(),
    type: exports.AiModelTypeSchema.optional(),
});
exports.ToggleAiModelEnableSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    id: zod_1.z.string(),
    providerId: zod_1.z.string(),
    source: zod_1.z.enum(['builtin', 'custom', 'remote']).optional(),
    type: exports.AiModelTypeSchema.optional(),
});
//# sourceMappingURL=aiModel.js.map