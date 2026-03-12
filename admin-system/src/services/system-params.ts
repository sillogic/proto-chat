import { request } from '@umijs/max';

export interface AdminParam {
  description?: string;
  key: string;
  value: string;
}

export async function getAdminParams(): Promise<{ data: AdminParam[] }> {
  return request('/api/admin/system-config/params', { method: 'GET' });
}

export async function getAdminParam(key: string): Promise<{ data: { key: string; value: string } }> {
  return request('/api/admin/system-config/params', { method: 'GET', params: { key } });
}

export async function setAdminParam(key: string, value: string) {
  return request('/api/admin/system-config/params', {
    data: { key, value },
    method: 'POST',
  });
}
