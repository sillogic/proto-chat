// API 响应的基础类型
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

// 管理员用户信息
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  authMethod?: 'local' | 'casdoor';
  casdoorId?: string;
}

// 登录请求参数
export interface LoginParams {
  username: string;
  password: string;
}

// Casdoor登录响应
export interface CasdoorAuthResponse {
  success: boolean;
  data: {
    authUrl: string;
  };
}

// 登录响应
export interface LoginResult {
  success: boolean;
  data?: {
    token: string;
    user: AdminUser;
    redirectTo?: string;
  };
  message?: string;
}

// 用户信息
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  planType: 'free' | 'basic' | 'pro' | 'enterprise';
  monthlyTokenLimit: number;
  monthlyApiCallsLimit: number;
  features: Record<string, any>;
  status: 'active' | 'suspended' | 'expired';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// 用户列表查询参数
export interface UserListParams {
  current?: number;
  pageSize?: number;
  keyword?: string;
  planType?: string;
  status?: string;
}

// 用户列表响应
export interface UserListResponse {
  data: {
    users: User[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  success: boolean;
}

// 更新用户套餐参数
export interface UpdateUserPlanParams {
  userId: string;
  planType: 'free' | 'basic' | 'pro' | 'enterprise';
  monthlyTokenLimit?: number;
  monthlyApiCallsLimit?: number;
  features?: Record<string, any>;
}

// 仪表盘统计数据
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalPlans: number;
  totalApiKeys: number;
  todayTokenUsage: number;
  monthlyRevenue: number;
}