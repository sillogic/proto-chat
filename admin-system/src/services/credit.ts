import { request } from '@umijs/max';

export interface UsageStatParams {
    userId: string;
    month?: string;
}

export async function getUsageStats(params: UsageStatParams) {
    return request('/api/admin/stats', {
        method: 'GET',
        params,
    });
}
