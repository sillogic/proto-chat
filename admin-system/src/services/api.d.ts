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
  username?: string;
  full_name?: string;
  avatar?: string;
  planType: string;
  plan_name?: string;
  credit_balance?: string | number;
  nextPlanId?: string;
  monthlyTokenLimit: number | string;
  monthlyApiCallsLimit: number | string;
  monthlyStorageLimit: number | string;
  features: Record<string, any>;
  banned: boolean | 't' | 'f' | 0 | 1;
  created_at: string;
  updated_at: string;
  last_active_at?: string;
}

// 用户列表查询参数
export interface UserListParams {
  current?: number;
  pageSize?: number;
  keyword?: string;    // 邮箱搜索
  planType?: string;   // 方案类型筛选
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
  planId?: string;
  currentPlan?: string;
  features?: Record<string, any>;
  planExpiresAt?: string;
}

// 仪表盘统计数据（旧版，保留兼容性）
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalPlans: number;
  totalApiKeys: number;
  todayTokenUsage: number;
  monthlyRevenue: number;
}

// ============================================
// 增强版仪表盘数据类型定义
// ============================================

// 时间周期类型
export type DashboardPeriod = '7d' | '30d' | '90d';

// 存量指标（快照数据，不受 period 影响）
export interface SnapshotMetrics {
  // 用户统计
  totalUsers: number;           // 总用户数
  activeUsers: number;          // 活跃用户数（最近 7 天）
  todayActiveUsers: number;     // 今日活跃用户数

  // 订阅统计
  activeSubscriptions: number;  // 当前活跃订阅数

  // 收入快照（MRR/ARR 不受 period 影响）
  mrr: number;                  // 月度经常性收入 Monthly Recurring Revenue
  arr: number;                  // 年度经常性收入 Annual Recurring Revenue = MRR × 12

  // 套餐分布
  planDistribution: {
    free: number;
    lite: number;
    pro: number;
    ultra: number;
  };
}

// 流量指标（受 period 影响）
export interface PeriodMetrics {
  period: DashboardPeriod;

  // 收入数据（指定时间段内的新收入）
  totalRevenue: number;         // 总收入（¥）
  newSubscriptions: number;     // 新增订阅数
  churnedSubscriptions: number; // 流失订阅数

  // 用户数据（指定时间段内）
  newUsers: number;             // 新增用户数

  // AI 使用数据（指定时间段内）
  totalApiCalls: number;        // API 调用总数
  totalTokens: number;          // Token 消耗总量

  // 收入趋势（按天聚合）
  revenueTrend: Array<{
    date: string;               // YYYY-MM-DD
    revenue: number;            // 当日收入（¥）
  }>;

  // 用户增长趋势（按天聚合）
  userGrowthTrend: Array<{
    date: string;               // YYYY-MM-DD
    newUsers: number;           // 新增用户数
    activeUsers: number;        // 活跃用户数
  }>;
}

// AI 使用统计
export interface AIUsageStats {
  // 按供应商分组
  byProvider: Array<{
    provider: string;           // 'openai' | 'anthropic' | 'protochat' | ...
    calls: number;              // 调用次数
    percentage: number;         // 占比
  }>;

  // 热门模型 TOP 10
  topModels: Array<{
    model: string;              // 模型名称
    provider: string;           // 供应商
    calls: number;              // 调用次数
    tokens: number;             // Token 数
  }>;

  // 每小时活跃度（0-23 小时）
  hourlyActivity: Array<{
    hour: number;               // 0-23
    messages: number;           // 消息数量
  }>;
}

// 用户留存率队列
export interface RetentionCohort {
  date: string;                 // 注册日期 YYYY-MM-DD
  users: number;                // 当日注册用户数
  d1: number;                   // Day 1 留存率（0-1）
  d7: number;                   // Day 7 留存率（0-1）
  d30: number;                  // Day 30 留存率（0-1）
}

// 增强版仪表盘完整数据
export interface EnhancedDashboardData {
    snapshot: SnapshotMetrics;          // 存量指标（快照）
    period: PeriodMetrics;              // 流量指标（期间数据）
    aiUsage: AIUsageStats;              // AI 使用统计
    retentionCohorts: RetentionCohort[]; // 留存率队列（最近 30 天）
}