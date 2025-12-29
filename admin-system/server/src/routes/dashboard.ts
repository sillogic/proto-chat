import express from 'express';
import { db } from '../config/database';
import { users } from '../db/schema';
import { desc, and, count, gte, lte, sql, ne } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// GET /api/dashboard/stats - 获取仪表盘统计数据
router.get('/stats', requirePermission('stats.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { period = '7d' } = req.query;

    // 计算时间范围
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '24h': {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      }
      case '7d': {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case '30d': {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      }
      case '90d': {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      }
      default: {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    // 获取用户总数
    const totalUsersResult = await db
      .select({ count: count() })
      .from(users);

    // 获取活跃用户数（最近7天有活动的用户）
    const activeUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        ne(users.banned, true),
        gte(users.lastActiveAt, startDate)
      ));

    // 获取新增用户数（指定时间段内）
    const newUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, startDate));

    // 获取各套餐用户分布
    const planDistributionResult = await db.execute(sql.raw(`
      SELECT
        current_plan as planType,
        COUNT(*) as count
      FROM user_extensions
      GROUP BY current_plan
    `)) as unknown as { count: number; planType: string; }[];

    // 获取最近7天的用户增长趋势
    const userGrowthTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

      const dailyUsers = await db
        .select({ count: count() })
        .from(users)
        .where(and(
          gte(users.createdAt, startOfDay),
          lte(users.createdAt, endOfDay)
        ));

      userGrowthTrend.push({
        date: startOfDay.toISOString().split('T')[0],
        newUsers: dailyUsers[0]?.count || 0,
      });
    }

    // 构建套餐分布数据
    const planDistribution = {
      basic: 0,
      enterprise: 0,
      free: 0,
      pro: 0,
    };

    planDistributionResult.forEach(result => {
      if (result.planType in planDistribution) {
        planDistribution[result.planType as keyof typeof planDistribution] = result.count;
      }
    });

    // 获取今日活跃用户（简单的基于lastActiveAt的估算）
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayActiveUsers = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        ne(users.banned, true),
        gte(users.lastActiveAt, todayStart)
      ));

    const stats = {
      activeUsers: activeUsersResult[0]?.count || 0,
      newUsers: newUsersResult[0]?.count || 0,
      planDistribution,
      todayActiveUsers: todayActiveUsers[0]?.count || 0,
      totalUsers: totalUsersResult[0]?.count || 0,
      userGrowthTrend,
    };

    return res.json({
      data: stats,
      success: true,
    });
  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({
      message: '获取仪表盘统计数据失败',
      success: false,
    });
  }
});

// GET /api/dashboard/recent-users - 获取最近注册的用户
router.get('/recent-users', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const recentUsers = await db
      .select({
        avatarUrl: users.avatar,
        createdAt: users.createdAt,
        email: users.email,
        id: users.id,
        isActive: sql<boolean>`CASE WHEN ${users.banned} = false THEN true ELSE false END`,
        username: users.username,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);

    return res.json({
      data: {
        users: recentUsers,
      },
      success: true,
    });
  } catch (error: any) {
    console.error('Get recent users error:', error);
    return res.status(500).json({
      message: '获取最近用户失败',
      success: false,
    });
  }
});

export default router;