import { request } from '@umijs/max';
import type {
  LoginParams,
  LoginResult,
  UserListParams,
  UserListResponse,
  UpdateUserPlanParams,
  DashboardStats,
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
  return request('/api/users/update-plan', {
    method: 'POST',
    data: params,
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

// 删除用户
export async function deleteUser(userId: string): Promise<{ success: boolean }> {
  return request(`/api/user-management/${userId}`, {
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