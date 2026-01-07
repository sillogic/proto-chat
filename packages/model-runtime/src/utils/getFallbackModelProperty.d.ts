import type { AiFullModelCard } from 'model-bank';
/**
 * Get the model property value, first from the specified provider, and then from other providers as a fallback.
 * @param modelId The ID of the model.
 * @param propertyName The name of the property.
 * @param providerId Optional provider ID for an exact match.
 * @returns The property value or a default value.
 */
export declare const getModelPropertyWithFallback: <T>(modelId: string, propertyName: keyof AiFullModelCard, providerId?: string) => Promise<T>;
//# sourceMappingURL=getFallbackModelProperty.d.ts.map