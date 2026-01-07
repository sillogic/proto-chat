"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeFalAI = void 0;
const client_1 = require("@fal-ai/client");
const debug_1 = __importDefault(require("debug"));
const lodash_es_1 = require("lodash-es");
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
// Create debug logger
const log = (0, debug_1.default)('lobe-image:fal');
class LobeFalAI {
    constructor({ apiKey } = {}) {
        if (!apiKey)
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey);
        client_1.fal.config({
            credentials: apiKey,
        });
        log('FalAI initialized with apiKey: %s', apiKey ? '*****' : 'Not set');
    }
    async createImage(payload) {
        const { model, params } = payload;
        log('Creating image with model: %s and params: %O', model, params);
        const paramsMap = new Map([
            ['steps', 'num_inference_steps'],
            ['cfg', 'guidance_scale'],
            ['imageUrl', 'image_url'],
            ['imageUrls', 'image_urls'],
            ['size', 'image_size'],
        ]);
        const defaultInput = {
            enable_safety_checker: false,
            num_images: 1,
        };
        const userInput = Object.fromEntries(Object.entries(params)
            .filter(([, value]) => {
            const isEmptyValue = value === null || value === undefined || (Array.isArray(value) && value.length === 0);
            return !isEmptyValue;
        })
            .map(([key, value]) => [paramsMap.get(key) ?? key, value]));
        if ('width' in userInput && 'height' in userInput) {
            if (userInput.size) {
                throw new Error('width/height and size are not supported at the same time');
            }
            else {
                userInput.image_size = {
                    height: userInput.height,
                    width: userInput.width,
                };
                delete userInput.width;
                delete userInput.height;
            }
        }
        const modelsAcceleratedByDefault = new Set(['flux/krea']);
        if (modelsAcceleratedByDefault.has(model)) {
            defaultInput['acceleration'] = 'high';
        }
        // Ensure model has fal-ai/ prefix
        let endpoint = model.startsWith('fal-ai/') ? model : `fal-ai/${model}`;
        const hasImageUrls = (params.imageUrls?.length ?? 0) > 0;
        if (['fal-ai/bytedance/seedream/v4', 'fal-ai/hunyuan-image/v3'].includes(endpoint)) {
            endpoint += hasImageUrls ? '/edit' : '/text-to-image';
        }
        else if (endpoint === 'fal-ai/nano-banana' && hasImageUrls) {
            endpoint += '/edit';
        }
        const finalInput = {
            ...defaultInput,
            ...userInput,
        };
        log('Calling fal.subscribe with endpoint: %s and input: %O', endpoint, finalInput);
        try {
            const { data } = await client_1.fal.subscribe(endpoint, {
                input: finalInput,
            });
            const image = data.images[0];
            return {
                imageUrl: image.url,
                ...(0, lodash_es_1.pick)(image, ['width', 'height']),
            };
        }
        catch (error) {
            // https://docs.fal.ai/model-apis/errors/
            if (error instanceof Error && 'status' in error && error.status === 401) {
                throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey, {
                    error,
                });
            }
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.ProviderBizError, { error });
        }
    }
}
exports.LobeFalAI = LobeFalAI;
//# sourceMappingURL=index.js.map