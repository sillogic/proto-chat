import { request } from '@umijs/max';

export interface AiProviderConfig {
    id: string;
    name?: string;
    enabled: boolean;
    fetchOnClient: boolean;
    logo?: string;
    description?: string;
    keyVaults?: Record<string, any>;
    settings?: Record<string, any>;
    config?: Record<string, any>;
    isGlobal: boolean;
    createdAt?: string;
    updatedAt?: string;
}

/** Get all global AI providers */
export async function getGlobalAiProviders() {
    return request<{ data: AiProviderConfig[]; success: boolean }>('/api/admin/ai-providers', {
        method: 'GET',
    });
}

/** Upsert global AI provider */
export async function upsertGlobalAiProvider(data: Partial<AiProviderConfig>) {
    return request<{ success: boolean }>('/api/admin/ai-providers', {
        method: 'POST',
        data,
    });
}

/** Delete global AI provider */
export async function deleteGlobalAiProvider(id: string) {
    return request<{ success: boolean }>(`/api/admin/ai-providers/${id}`, {
        method: 'DELETE',
    });
}
