import { request } from '@umijs/max';

// =============================================
// Types - 类型定义
// =============================================

export interface ProtoChatProvider {
    id: string;
    name: string;
    type: 'aggregator' | 'direct';
    enabled: boolean;
    priority: number;
    apiKey?: string;
    baseUrl?: string;
    apiEndpoint?: string;
    pricingSyncStrategy?: 'api' | 'model_bank' | 'manual';
    pricingApiUrl?: string;
    settings?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProtoChatModel {
    id: string;
    originalId: string;
    originalProvider: string;
    displayName: string;
    type: 'chat' | 'image' | 'embedding';
    enabled: boolean;
    capabilities?: Record<string, boolean>;
    contextTokens?: number;
    maxOutput?: number;
    parameters?: Record<string, any>;
    settings?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
    pricing?: ProtoChatPricing;
}

export interface ProtoChatPricing {
    id?: number;
    modelId: string;
    costInputPrice: number;
    costOutputPrice: number;
    userInputPrice: number;
    userOutputPrice: number;
    currency?: string;
    priceSource?: 'api' | 'model_bank' | 'manual';
    isFree?: boolean;
    syncedAt?: string;
    modelDisplayName?: string;
    modelEnabled?: boolean;
}

export interface ProtoChatSettings {
    [key: string]: {
        value: number;
        description: string | null;
    };
}

export interface ProtoChatUsageLog {
    id: number;
    userId: string;
    modelId: string;
    originalProvider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costPrice?: string;
    userPrice?: string;
    requestId?: string;
    createdAt: string;
}

export interface UsageStats {
    total: {
        totalRequests: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCostPrice: number;
        totalUserPrice: number;
    };
    byModel: Array<{
        modelId: string;
        requests: number;
        inputTokens: number;
        outputTokens: number;
        costPrice: number;
        userPrice: number;
    }>;
    byProvider: Array<{
        provider: string;
        requests: number;
        inputTokens: number;
        outputTokens: number;
        costPrice: number;
        userPrice: number;
    }>;
}

// =============================================
// Providers - 供应商管理
// =============================================

/** 获取所有ProtoChat供应商 */
export async function getProtoChatProviders() {
    return request<{ data: ProtoChatProvider[]; success: boolean }>('/api/admin/protochat/providers', {
        method: 'GET',
    });
}

/** 获取单个ProtoChat供应商详情 */
export async function getProtoChatProvider(id: string) {
    return request<{ data: ProtoChatProvider; success: boolean }>(`/api/admin/protochat/providers/${id}`, {
        method: 'GET',
    });
}

/** 创建或更新ProtoChat供应商 */
export async function upsertProtoChatProvider(data: Partial<ProtoChatProvider>) {
    return request<{ success: boolean; message?: string }>('/api/admin/protochat/providers', {
        method: 'POST',
        data,
    });
}

/** 删除ProtoChat供应商 */
export async function deleteProtoChatProvider(id: string) {
    return request<{ success: boolean; message?: string }>(`/api/admin/protochat/providers/${id}`, {
        method: 'DELETE',
    });
}

/** 从Model-Bank同步供应商模型 */
export async function syncProtoChatModels(providerId: string) {
    return request<{
        success: boolean;
        message?: string;
        data?: {
            providerId: string;
            providerName: string;
            syncedModels: number;
            syncedPricing: number;
        };
    }>(`/api/admin/protochat/providers/${providerId}/sync`, {
        method: 'POST',
    });
}

// =============================================
// Models - 模型管理
// =============================================

export interface GetModelsParams {
    provider?: string;
    enabled?: string;
    type?: string;
    search?: string;
}

/** 获取所有ProtoChat模型 */
export async function getProtoChatModels(params?: GetModelsParams) {
    return request<{ data: ProtoChatModel[]; success: boolean }>('/api/admin/protochat/models', {
        method: 'GET',
        params,
    });
}

/** 获取单个ProtoChat模型详情 */
export async function getProtoChatModel(id: string) {
    return request<{ data: ProtoChatModel; success: boolean }>(`/api/admin/protochat/models/${id}`, {
        method: 'GET',
    });
}

/** 创建或更新ProtoChat模型 */
export async function upsertProtoChatModel(data: Partial<ProtoChatModel>) {
    return request<{ success: boolean; message?: string }>('/api/admin/protochat/models', {
        method: 'POST',
        data,
    });
}

/** 切换模型启用状态 */
export async function toggleProtoChatModel(id: string) {
    return request<{ success: boolean; message?: string; data?: { enabled: boolean } }>(
        `/api/admin/protochat/models/${id}/toggle`,
        {
            method: 'PUT',
        },
    );
}

/** 删除ProtoChat模型 */
export async function deleteProtoChatModel(id: string) {
    return request<{ success: boolean; message?: string }>(`/api/admin/protochat/models/${id}`, {
        method: 'DELETE',
    });
}

// =============================================
// Pricing - 定价管理
// =============================================

/** 获取所有ProtoChat定价 */
export async function getProtoChatPricing() {
    return request<{ data: ProtoChatPricing[]; success: boolean }>('/api/admin/protochat/pricing', {
        method: 'GET',
    });
}

/** 创建或更新ProtoChat定价 */
export async function upsertProtoChatPricing(data: Partial<ProtoChatPricing>) {
    return request<{ success: boolean; message?: string }>('/api/admin/protochat/pricing', {
        method: 'POST',
        data,
    });
}

// =============================================
// Settings - 全局设置
// =============================================

/** 获取ProtoChat全局设置 */
export async function getProtoChatSettings() {
    return request<{ data: ProtoChatSettings; success: boolean }>('/api/admin/protochat/settings', {
        method: 'GET',
    });
}

/** 更新ProtoChat设置 */
export async function updateProtoChatSettings(data: { id: string; value: number; description?: string }) {
    return request<{ success: boolean; message?: string }>('/api/admin/protochat/settings', {
        method: 'POST',
        data,
    });
}

// =============================================
// Usage Logs - 使用日志
// =============================================

export interface GetUsageLogsParams {
    userId?: string;
    modelId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}

/** 获取ProtoChat使用日志 */
export async function getProtoChatUsageLogs(params?: GetUsageLogsParams) {
    return request<{
        data: ProtoChatUsageLog[];
        pagination: { page: number; pageSize: number; total: number };
        success: boolean;
    }>('/api/admin/protochat/usage-logs', {
        method: 'GET',
        params,
    });
}

/** 获取ProtoChat使用统计 */
export async function getProtoChatUsageStats(params?: { startDate?: string; endDate?: string }) {
    return request<{ data: UsageStats; success: boolean }>('/api/admin/protochat/usage-stats', {
        method: 'GET',
        params,
    });
}
