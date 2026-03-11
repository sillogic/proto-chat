import { request } from '@umijs/max';

/**
 * Subscription Plan Types
 */
export interface SubscriptionPlan {
    id: string;
    name: string;
    slug: string;
    type: 'individual' | 'team';
    price: number;
    currency: string;
    interval: 'month' | 'year';
    credits: number | string;
    storageLimit: number;
    vectorLimit: number;
    features: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ModelPricing {
    id: string;
    model: string;
    provider: string;
    subProvider?: string | null; // 子供应商（仅 ProtoChat 使用）
    inputPrice: number | string;
    outputPrice: number | string;
    perRequestPrice?: number | string | null; // 按次计费（legacy fallback for providers without token usage）
    userInputPrice?: number | string; // 提示词用户价
    userOutputPrice?: number | string; // 补全用户价
    imageOutputPrice?: number | string | null; // 图片输出 token 成本价（credits/M tokens）
    userImageOutputPrice?: number | string | null; // 图片输出 token 用户价
    memo?: string;
    updatedAt: string;
}

/** Get all plans */
export async function getPlans() {
    return request<{ data: SubscriptionPlan[]; success: boolean; message?: string }>('/api/admin/plans', {
        method: 'GET',
    });
}

/** Get plan by ID */
export async function getPlanById(id: string) {
    return request<{ data: SubscriptionPlan; success: boolean; message?: string }>(`/api/admin/plans/${id}`, {
        method: 'GET',
    });
}

/** Create plan */
export async function createPlan(data: Partial<SubscriptionPlan>) {
    return request<{ data: SubscriptionPlan; success: boolean; message?: string }>('/api/admin/plans', {
        method: 'POST',
        data,
    });
}

/** Update plan */
export async function updatePlan(id: string, data: Partial<SubscriptionPlan>) {
    return request<{ data: SubscriptionPlan; success: boolean; message?: string }>(`/api/admin/plans/${id}`, {
        method: 'PUT',
        data,
    });
}

/** Delete plan */
export async function deletePlan(id: string) {
    return request<{ success: boolean; message?: string }>(`/api/admin/plans/${id}`, {
        method: 'DELETE',
    });
}

/** Get all model pricings */
export async function getModelPricings() {
    return request<{ data: ModelPricing[]; success: boolean; message?: string }>('/api/admin/models/pricing', {
        method: 'GET',
    });
}

/** Create model pricing */
export async function createModelPricing(data: Partial<ModelPricing>) {
    return request<{ data: ModelPricing; success: boolean; message?: string }>('/api/admin/models/pricing', {
        method: 'POST',
        data,
    });
}

/** Update model pricing */
export async function updateModelPricing(id: string, data: Partial<ModelPricing>) {
    return request<{ data: ModelPricing; success: boolean; message?: string }>(`/api/admin/models/pricing/${id}`, {
        method: 'PUT',
        data,
    });
}

/** Delete model pricing */
export async function deleteModelPricing(id: string) {
    return request<{ success: boolean; message?: string }>(`/api/admin/models/pricing/${id}`, {
        method: 'DELETE',
    });
}

/** Sync model pricings with providers */
export async function syncModelPricings() {
    return request<{ success: boolean; count?: number; message?: string }>('/api/admin/models/pricing/sync', {
        method: 'POST',
    });
}

export async function syncImageOutputPricings() {
    return request<{ success: boolean; updated?: number; failed?: { model: string; error: string }[] }>(
        '/api/admin/models/pricing/sync-image-output',
        { method: 'POST' },
    );
}
