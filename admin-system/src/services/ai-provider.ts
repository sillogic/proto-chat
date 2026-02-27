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

/** Check AI provider connectivity */
export async function checkAiProvider(data: { id: string; model: string; keyVaults?: Record<string, any> }) {
    return request<{ message?: string; success: boolean; error?: any }>('/api/admin/ai-providers/check', {
        method: 'POST',
        data,
    });
}

export interface VideoCapableModel {
    id: string;
    displayName: string;
    providerId: string;
}

/** 获取所有具备视频生成能力的模型（不限供应商，不限启用状态） */
export async function getVideoCapableModels() {
    return request<{ data: VideoCapableModel[]; success: boolean }>('/api/admin/ai-providers/video-models', {
        method: 'GET',
    });
}
