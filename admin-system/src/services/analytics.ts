import { request } from '@umijs/max';

export interface AnalyticsParams {
  month?: string; // YYYY-MM format for month, YYYY format for year
  period?: 'month' | 'year';
}

// 成本分析
export async function getAnalyticsCost(params: AnalyticsParams) {
  return request('/api/admin/analytics/cost', {
    method: 'GET',
    params,
  });
}

// 收支概览
export async function getAnalyticsRevenue(params: AnalyticsParams) {
  return request('/api/admin/analytics/revenue', {
    method: 'GET',
    params,
  });
}

// 用户洞察
export async function getAnalyticsUsers(params: AnalyticsParams) {
  return request('/api/admin/analytics/users', {
    method: 'GET',
    params,
  });
}

// 汇率
export async function getExchangeRate(refresh = false) {
  return request('/api/admin/analytics/exchange-rate', {
    method: 'GET',
    params: { refresh: refresh ? 'true' : 'false' },
  });
}
