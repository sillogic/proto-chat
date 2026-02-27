import { request } from '@umijs/max';

// =============================================
// Types - 类型定义
// =============================================

export interface SystemVideoModelConfig {
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

/** 获取视频默认模型配置 */
export async function getSystemVideoModelConfig() {
  return request<{ data: SystemVideoModelConfig | null; success: boolean }>(
    '/api/admin/system-config/video-default-model',
    {
      method: 'GET',
    },
  );
}

/** 更新视频默认模型配置 */
export async function updateSystemVideoModelConfig(data: {
  modelId: string;
  displayName: string;
  providerId: string;
  providerName: string;
}) {
  return request<{ success: boolean; message?: string; data?: SystemVideoModelConfig }>(
    '/api/admin/system-config/video-default-model',
    {
      method: 'POST',
      data,
    },
  );
}
