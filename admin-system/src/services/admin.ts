import { request } from '@umijs/max';
import type {
  LoginParams,
  LoginResult,
  UserListParams,
  UserListResponse,
  UpdateUserPlanParams,
  DashboardStats,
  EnhancedDashboardData,
  DashboardPeriod,
} from './api.d';

// 管理员登录
export async function adminLogin(params: LoginParams): Promise<LoginResult> {
  return request('/api/auth/login', {
    method: 'POST',
    data: params,
  });
}

// 创建管理员用户
export async function createAdminUser(params: {
  username: string;
  email: string;
  password: string;
  role?: string;
}): Promise<{ data: any; success: boolean }> {
  return request('/api/admin/users', {
    method: 'POST',
    data: params,
  });
}

// 重置管理员密码
export async function resetAdminPassword(userId: string, newPassword: string): Promise<{ success: boolean }> {
  return request(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    data: { password: newPassword },
  });
}

// 获取用户列表
export async function getUserList(params: UserListParams): Promise<UserListResponse> {
  return request('/api/users', {
    method: 'GET',
    params,
  });
}

// 获取用户详情
export async function getUserDetail(id: string): Promise<{ data: any; success: boolean }> {
  return request(`/api/users/${id}`, {
    method: 'GET',
  });
}

// 更新用户套餐
export async function updateUserPlan(params: UpdateUserPlanParams): Promise<{ success: boolean }> {
  const { userId, ...data } = params;
  return request(`/api/users/${userId}/plan`, {
    method: 'POST',
    data,
  });
}

/** 立即升级订阅 (仿真) */
export async function upgradeSubscription(userId: string, planId: string) {
  return request<{ success: boolean; message?: string }>(`/api/users/${userId}/plan/upgrade`, {
    method: 'POST',
    data: { planId },
  });
}

/** 预设变更 (仿真) */
export async function schedulePlanChange(userId: string, nextPlanId: string | null) {
  return request<{ success: boolean; message?: string }>(`/api/users/${userId}/plan/schedule`, {
    method: 'POST',
    data: { nextPlanId },
  });
}

/** 仿真过期处理 */
export async function simulateExpiry(userId: string) {
  return request<{ success: boolean; message?: string }>(`/api/users/${userId}/plan/simulate-expiry`, {
    method: 'POST',
  });
}

// 更新用户套餐状态
export async function updateUserPlanStatus(
  userId: string,
  status: 'active' | 'suspended' | 'expired'
): Promise<{ success: boolean }> {
  return request(`/api/users/${userId}/status`, {
    method: 'PUT',
    data: { status },
  });
}

// 获取仪表盘统计数据
export async function getDashboardStats(): Promise<{ data: DashboardStats; success: boolean }> {
  return request('/api/dashboard/stats', {
    method: 'GET',
  });
}

// ============ Casdoor SSO 相关接口 ============

// 获取Casdoor授权URL
export async function getCasdoorAuthUrl(redirectTo?: string): Promise<{ data: { authUrl: string; state: string }; success: boolean }> {
  return request('/api/auth/casdoor/login', {
    method: 'GET',
    params: { redirect_to: redirectTo },
  });
}

// 处理Casdoor回调
export async function handleCasdoorCallback(code: string, state: string): Promise<LoginResult> {
  return request('/api/auth/casdoor/callback', {
    method: 'GET',
    params: { code, state },
  });
}

// 获取当前Casdoor用户信息
export async function getCurrentCasdoorUser(): Promise<{ data: { user: any }; success: boolean }> {
  return request('/api/auth/casdoor/current-user', {
    method: 'GET',
  });
}

// Casdoor登出
export async function casdoorLogout(): Promise<{ success: boolean }> {
  return request('/api/auth/casdoor/logout', {
    method: 'POST',
  });
}

// ============ 用户管理相关接口 ============

// 创建新用户（同步到Casdoor）
export async function createUser(params: {
  username: string;
  displayName: string;
  email: string;
  password: string;
  phone?: string;
  userType?: 'user' | 'admin' | 'super_admin';
}): Promise<{ data: { user: any }; success: boolean }> {
  return request('/api/user-management', {
    method: 'POST',
    data: params,
  });
}

// 更新用户信息
export async function updateUser(userId: string, params: {
  displayName?: string;
  email?: string;
  phone?: string;
  banned?: boolean;
}): Promise<{ data: { user: any }; success: boolean }> {
  return request(`/api/user-management/${userId}`, {
    method: 'PUT',
    data: params,
  });
}

// 更新用户状态（启用/禁用）
export async function updateUserStatus(userId: string, params: { banned: boolean; banReason?: string }): Promise<{ success: boolean }> {
  return request(`/api/users/${userId}/status`, {
    method: 'PUT',
    data: params,
  });
}

// 注销用户（软删除：匿名化 + 清理数据，保留成本记录）
export async function purgeUser(userId: string): Promise<{ success: boolean; message?: string; data?: { deletedMessages: number; deletedFiles: number; deletedOssObjects: number } }> {
  return request(`/api/users/${userId}`, {
    method: 'DELETE',
  });
}

// 获取用户管理列表（支持搜索和过滤）
export async function getUserManagementList(params: {
  page?: number;
  limit?: number;
  search?: string;
  userType?: string;
}): Promise<{ data: { users: any[]; pagination: any }; success: boolean }> {
  return request('/api/user-management', {
    method: 'GET',
    params,
  });
}

// ============================================
// 增强版仪表盘服务接口
// ============================================

/**
 * 获取增强版仪表盘数据
 * @param period 时间周期：7d | 30d | 90d
 */
export async function getEnhancedDashboard(
  period: DashboardPeriod = '30d',
): Promise<{ data: EnhancedDashboardData; success: boolean }> {
  return request('/api/dashboard/enhanced', {
    method: 'GET',
    params: { period },
  }) as Promise<{ data: EnhancedDashboardData; success: boolean }>;
}
/**
 * 获取存量指标（快照数据，不受 period 影响）
 * 包括：MRR、ARR、总用户数、活跃订阅数等
 */
export async function getSnapshotMetrics(): Promise<{
  data: EnhancedDashboardData['snapshot'];
  success: boolean;
}> {
  return request('/api/dashboard/snapshot', {
    method: 'GET',
  });
}

/**
 * 获取流量指标（受 period 影响）
 * @param period 时间周期：7d | 30d | 90d
 */
export async function getPeriodMetrics(
  period: DashboardPeriod = '30d',
): Promise<{ data: EnhancedDashboardData['period']; success: boolean }> {
  return request('/api/dashboard/period-metrics', {
    method: 'GET',
    params: { period },
  });
}

/**
 * 获取 AI 使用统计
 * @param period 时间周期：7d | 30d | 90d
 */
export async function getAIUsageStats(
  period: DashboardPeriod = '30d',
): Promise<{ data: EnhancedDashboardData['aiUsage']; success: boolean }> {
  return request('/api/dashboard/ai-usage', {
    method: 'GET',
    params: { period },
  });
}

/**
 * 获取用户留存率队列数据
 * @param days 显示最近多少天的队列（默认 30 天）
 */
export async function getRetentionCohorts(days: number = 30): Promise<{
  data: EnhancedDashboardData['retentionCohorts'];
  success: boolean;
}> {
  return request('/api/dashboard/retention', {
    method: 'GET',
    params: { days },
  });
}

// 导出类型供组件使用
export type { EnhancedDashboardData, DashboardPeriod };