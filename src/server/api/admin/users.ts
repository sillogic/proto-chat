import { z } from 'zod';
import { adminProcedure, router } from '../trpc';

// 模拟用户数据（生产环境应该从数据库查询）
export const mockUsers = [
  {
    id: 'user_001',
    email: 'john@example.com',
    name: 'John Doe',
    avatar: null,
    planType: 'basic' as const,
    monthlyTokenLimit: 100000,
    monthlyApiCallsLimit: 1000,
    features: {
      modelAccess: ['gpt-3.5-turbo', 'gpt-4'],
      fileUpload: true,
      customInstructions: true,
    },
    status: 'active' as const,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
    lastLoginAt: '2024-01-20T10:30:00Z',
  },
  {
    id: 'user_002',
    email: 'jane@example.com',
    name: 'Jane Smith',
    avatar: null,
    planType: 'free' as const,
    monthlyTokenLimit: 10000,
    monthlyApiCallsLimit: 100,
    features: {
      modelAccess: ['gpt-3.5-turbo'],
      fileUpload: false,
      customInstructions: false,
    },
    status: 'active' as const,
    createdAt: '2024-01-18T14:20:00Z',
    updatedAt: '2024-01-18T14:20:00Z',
    lastLoginAt: '2024-01-22T16:45:00Z',
  },
  {
    id: 'user_003',
    email: 'bob@example.com',
    name: 'Bob Wilson',
    avatar: null,
    planType: 'pro' as const,
    monthlyTokenLimit: 500000,
    monthlyApiCallsLimit: 5000,
    features: {
      modelAccess: ['gpt-3.5-turbo', 'gpt-4', 'claude-3'],
      fileUpload: true,
      customInstructions: true,
      prioritySupport: true,
    },
    status: 'suspended' as const,
    createdAt: '2024-01-10T09:15:00Z',
    updatedAt: '2024-01-25T11:20:00Z',
    lastLoginAt: '2024-01-24T13:10:00Z',
  },
];

export const usersRouter = router({
  list: adminProcedure
    .input(
      z.object({
        current: z.number().optional().default(1),
        pageSize: z.number().optional().default(20),
        keyword: z.string().optional(),
        planType: z.string().optional(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ input }: { input: any }) => {
      let filteredUsers = [...mockUsers];

      // 关键词搜索
      if (input.keyword) {
        const keyword = input.keyword.toLowerCase();
        filteredUsers = filteredUsers.filter(user =>
          user.email.toLowerCase().includes(keyword) ||
          (user.name && user.name.toLowerCase().includes(keyword))
        );
      }

      // 套餐类型筛选
      if (input.planType) {
        filteredUsers = filteredUsers.filter(user => user.planType === input.planType);
      }

      // 状态筛选
      if (input.status) {
        filteredUsers = filteredUsers.filter(user => user.status === input.status);
      }

      // 分页
      const total = filteredUsers.length;
      const start = (input.current - 1) * input.pageSize;
      const end = start + input.pageSize;
      const data = filteredUsers.slice(start, end);

      return {
        success: true,
        data,
        total,
      };
    }),

  detail: adminProcedure
    .input(z.string())
    .query(async ({ input }: { input: any }) => {
      const user = mockUsers.find(u => u.id === input);

      if (!user) {
        throw new Error('用户不存在');
      }

      return {
        success: true,
        data: user,
      };
    }),

  updatePlan: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        planType: z.enum(['free', 'basic', 'pro', 'enterprise']),
        monthlyTokenLimit: z.number().optional(),
        monthlyApiCallsLimit: z.number().optional(),
        features: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input }: { input: any }) => {
      const userIndex = mockUsers.findIndex(u => u.id === input.userId);

      if (userIndex === -1) {
        throw new Error('用户不存在');
      }

      // 更新用户信息
      mockUsers[userIndex] = {
        ...mockUsers[userIndex],
        planType: input.planType,
        monthlyTokenLimit: input.monthlyTokenLimit ?? mockUsers[userIndex].monthlyTokenLimit,
        monthlyApiCallsLimit: input.monthlyApiCallsLimit ?? mockUsers[userIndex].monthlyApiCallsLimit,
        features: input.features ?? mockUsers[userIndex].features,
        updatedAt: new Date().toISOString(),
      };

      return { success: true };
    }),

  updateStatus: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        status: z.enum(['active', 'suspended', 'expired']),
      }),
    )
    .mutation(async ({ input }: { input: any }) => {
      const userIndex = mockUsers.findIndex(u => u.id === input.userId);

      if (userIndex === -1) {
        throw new Error('用户不存在');
      }

      // 更新用户状态
      mockUsers[userIndex] = {
        ...mockUsers[userIndex],
        status: input.status,
        updatedAt: new Date().toISOString(),
      };

      return { success: true };
    }),
});