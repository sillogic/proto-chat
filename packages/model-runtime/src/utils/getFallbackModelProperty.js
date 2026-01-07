"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelPropertyWithFallback = void 0;
/**
 * Get the model property value, first from the specified provider, and then from other providers as a fallback.
 * @param modelId The ID of the model.
 * @param propertyName The name of the property.
 * @param providerId Optional provider ID for an exact match.
 * @returns The property value or a default value.
 */
const getModelPropertyWithFallback = async (modelId, propertyName, providerId) => {
    const { LOBE_DEFAULT_MODEL_LIST } = await Promise.resolve().then(() => __importStar(require('model-bank')));
    // Step 1: If providerId is provided, prioritize an exact match (same provider + same id)
    if (providerId) {
        const exactMatch = LOBE_DEFAULT_MODEL_LIST.find((m) => m.id === modelId && m.providerId === providerId);
        if (exactMatch && exactMatch[propertyName] !== undefined) {
            return exactMatch[propertyName];
        }
    }
    // Step 2: Fallback to a match ignoring the provider (match id only)
    const fallbackMatch = LOBE_DEFAULT_MODEL_LIST.find((m) => m.id === modelId);
    if (fallbackMatch && fallbackMatch[propertyName] !== undefined) {
        return fallbackMatch[propertyName];
    }
    // Step 3: Return a default value
    return (propertyName === 'type' ? 'chat' : undefined);
};
exports.getModelPropertyWithFallback = getModelPropertyWithFallback;
//# sourceMappingURL=getFallbackModelProperty.js.map