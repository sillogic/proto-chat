import { request } from '@umijs/max';

// =============================================
// Types - 类型定义
// =============================================

export interface SystemDefaultModelConfig {
  id: string;
  modelId: string | null;
  displayName: string | null;
  providerId: string | null;
  providerName: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================
// API Functions
// =============================================

/** 获取默认模型配置 */
export async function getSystemDefaultModelConfig() {
  return request<{ data: SystemDefaultModelConfig | null; success: boolean }>(
    '/api/admin/system-config/default-model',
    {
      method: 'GET',
    },
  );
}

/** 更新默认模型配置 */
export async function updateSystemDefaultModelConfig(data: {
  modelId: string;
  displayName: string;
  providerId: string;
  providerName: string;
}) {
  return request<{ success: boolean; message?: string; data?: SystemDefaultModelConfig }>(
    '/api/admin/system-config/default-model',
    {
      method: 'POST',
      data,
    },
  );
}
