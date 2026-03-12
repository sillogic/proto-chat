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

export interface ConsumptionParams {
    userId: string;
    dateFrom?: string;
    dateTo?: string;
    type?: string;
    model?: string;
    limit?: number;
    offset?: number;
}

export async function getUsageConsumption(params: ConsumptionParams) {
    return request('/api/admin/stats/consumption', {
        method: 'GET',
        params,
    });
}

export interface TransactionParams {
    userId: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
}

export async function getUsageTransactions(params: TransactionParams) {
    return request('/api/admin/stats/transactions', {
        method: 'GET',
        params,
    });
}
