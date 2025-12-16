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
  return request('/api/admin/auth/login', {
    method: 'POST',
    data: params,
  });
}

// 获取用户列表
export async function getUserList(params: UserListParams): Promise<UserListResponse> {
  return request('/api/admin/users', {
    method: 'GET',
    params,
  });
}

// 获取用户详情
export async function getUserDetail(id: string): Promise<{ data: any; success: boolean }> {
  return request(`/api/admin/users/${id}`, {
    method: 'GET',
  });
}

// 更新用户套餐
export async function updateUserPlan(params: UpdateUserPlanParams): Promise<{ success: boolean }> {
  return request('/api/admin/users/update-plan', {
    method: 'POST',
    data: params,
  });
}

// 更新用户状态
export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended' | 'expired'
): Promise<{ success: boolean }> {
  return request(`/api/admin/users/${userId}/status`, {
    method: 'PUT',
    data: { status },
  });
}

// 获取仪表盘统计数据
export async function getDashboardStats(): Promise<{ data: DashboardStats; success: boolean }> {
  return request('/api/admin/dashboard/stats', {
    method: 'GET',
  });
}