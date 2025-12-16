import { z } from 'zod';
import { adminProcedure, router } from './trpc';
import { mockUsers } from './users';

export const dashboardRouter = router({
  stats: adminProcedure.query(async () => {
    // 计算统计数据
    const totalUsers = mockUsers.length;
    const activeUsers = mockUsers.filter(user => user.status === 'active').length;

    // 计算套餐统计
    const planStats = mockUsers.reduce((acc, user) => {
      acc[user.planType] = (acc[user.planType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalPlans = Object.keys(planStats).length;

    // 模拟 API Key 统计（后续从真实数据获取）
    const totalApiKeys = 15; // 模拟数据

    // 模拟 Token 使用统计（后续从真实数据获取）
    const todayTokenUsage = 125680; // 模拟数据

    // 模拟收入统计（后续从真实数据获取）
    const monthlyRevenue = 15234.50; // 模拟数据

    return {
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalPlans,
        totalApiKeys,
        todayTokenUsage,
        monthlyRevenue,
      },
    };
  }),
});