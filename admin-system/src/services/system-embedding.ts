import { request } from '@umijs/max';

export interface SystemEmbeddingConfig {
  apiKey?: string;
  baseUrl?: string;
  contextTokens?: number;
  createdAt: string;
  currency?: string;
  dimensions?: number;
  displayName?: string;
  id: string;
  inputPrice?: number;
  lastSyncedAt?: string;
  modelId: string;
  modelsSyncUrl?: string;
  providerId: string;
  updatedAt: string;
}

export interface SystemEmbeddingModel {
  contextTokens?: number;
  createdAt: string;
  currency?: string;
  dimensions?: number;
  displayName: string;
  id: number;
  inputPrice?: number;
  modelId: string;
  providerId: string;
  syncedAt?: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  success: boolean;
}

/**
 * 获取系统Embedding配置
 */
export async function getSystemEmbeddingConfig() {
  return request<ApiResponse<SystemEmbeddingConfig | null>>('/api/admin/system-embedding', {
    method: 'GET',
  });
}

/**
 * 更新系统Embedding配置
 */
export async function updateSystemEmbeddingConfig(data: {
  apiKey?: string;
  baseUrl?: string;
  contextTokens?: number;
  currency?: string;
  dimensions?: number;
  displayName?: string;
  inputPrice?: number;
  modelId: string;
  modelsSyncUrl?: string;
  providerId: string;
}) {
  return request<ApiResponse>('/api/admin/system-embedding', {
    method: 'POST',
    data,
  });
}

/**
 * 获取Embedding模型列表
 */
export async function getSystemEmbeddingModels() {
  return request<ApiResponse<SystemEmbeddingModel[]>>('/api/admin/system-embedding/models', {
    method: 'GET',
  });
}

/**
 * 同步Embedding模型列表
 */
export async function syncSystemEmbeddingModels() {
  return request<ApiResponse<{ syncedModels: number }>>('/api/admin/system-embedding/sync', {
    method: 'POST',
  });
}

/**
 * 测试Embedding连接
 */
export async function testSystemEmbeddingConnection(data: {
  apiKey: string;
  baseUrl: string;
  modelId: string;
}) {
  return request<
    ApiResponse<{
      duration: string;
      embeddingDimensions: number;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    }>
  >('/api/admin/system-embedding/test', {
    method: 'POST',
    data,
  });
}

/**
 * 获取Embedding使用日志
 */
export async function getSystemEmbeddingUsage(params?: { limit?: number; offset?: number }) {
  return request<ApiResponse<any[]>>('/api/admin/system-embedding/usage', {
    method: 'GET',
    params,
  });
}

/**
 * 获取记忆专用Embedding配置（id='memory'）
 */
export async function getMemoryEmbeddingConfig() {
  return request<ApiResponse<SystemEmbeddingConfig | null>>('/api/admin/system-embedding/memory', {
    method: 'GET',
  });
}

/**
 * 更新记忆专用Embedding配置（id='memory'）
 */
export async function updateMemoryEmbeddingConfig(data: {
  apiKey?: string;
  baseUrl?: string;
  contextTokens?: number;
  currency?: string;
  dimensions?: number;
  displayName?: string;
  inputPrice?: number;
  modelId: string;
  modelsSyncUrl?: string;
  providerId: string;
}) {
  return request<ApiResponse>('/api/admin/system-embedding/memory', {
    method: 'POST',
    data,
  });
}
