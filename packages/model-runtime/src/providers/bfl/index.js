"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeBflAI = void 0;
const debug_1 = __importDefault(require("debug"));
const error_1 = require("../../types/error");
const createError_1 = require("../../utils/createError");
const createImage_1 = require("./createImage");
const log = (0, debug_1.default)('lobe-image:bfl');
class LobeBflAI {
    constructor({ apiKey, baseURL } = {}) {
        if (!apiKey)
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey);
        this.apiKey = apiKey;
        this.baseURL = baseURL || undefined;
        log('BFL AI initialized');
    }
    async createImage(payload) {
        const { model, params } = payload;
        log('Creating image with model: %s and params: %O', model, params);
        try {
            return await (0, createImage_1.createBflImage)(payload, {
                apiKey: this.apiKey,
                baseURL: this.baseURL,
                provider: 'bfl',
            });
        }
        catch (error) {
            log('Error in createImage: %O', error);
            // Check for authentication errors based on HTTP status or error properties
            if (error instanceof Error && 'status' in error && error.status === 401) {
                throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.InvalidProviderAPIKey, {
                    error,
                });
            }
            // Wrap other errors
            throw createError_1.AgentRuntimeError.createError(error_1.AgentRuntimeErrorType.ProviderBizError, { error });
        }
    }
}
exports.LobeBflAI = LobeBflAI;
//# sourceMappingURL=index.js.map