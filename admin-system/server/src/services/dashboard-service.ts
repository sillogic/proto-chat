import { db } from '../config/database';
import { users } from '../db/schema';
import { userExtensions, userSubscriptionHistory } from '../db/user-extensions-schema';
import { subscriptionPlans } from '../db/subscription-schema';
import { messages } from '../db/messages-schema';
import { desc, and, count, gte, lte, sql, ne, eq, or, inArray } from 'drizzle-orm';

// 类型定义
export type DashboardPeriod = '7d' | '30d' | '90d';

export interface SnapshotMetrics {
  totalUsers: number;
  activeUsers: number;
  todayActiveUsers: number;
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  planDistribution: {
    free: number;
    lite: number;
    pro: number;
    ultra: number;
  };
}

export interface PeriodMetrics {
  period: DashboardPeriod;
  totalRevenue: number;
  newSubscriptions: number;
  churnedSubscriptions: number;
  newUsers: number;
  totalApiCalls: number;
  totalTokens: number;
  revenueTrend: Array<{ date: string; revenue: number }>;
  userGrowthTrend: Array<{ date: string; newUsers: number; activeUsers: number }>;
}

export interface AIUsageStats {
  byProvider: Array<{ provider: string; calls: number; percentage: number }>;
  topModels: Array<{ model: string; provider: string; calls: number; tokens: number }>;
  hourlyActivity: Array<{ hour: number; messages: number }>;
}

export interface RetentionCohort {
  date: string;
  users: number;
  d1: number;
  d7: number;
  d30: number;
}

// 辅助函数：计算时间范围
function getDateRange(period: DashboardPeriod): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let startDate: Date;

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
}

// 辅助函数：提取 tokens
function extractTokens(metadata: any): number {
  if (!metadata) return 0;
  const tokens = metadata.tokens || metadata.inputTokens || metadata.outputTokens || 0;
  if (typeof tokens === 'number') return tokens;
  if (typeof tokens === 'string') return parseInt(tokens, 10) || 0;
  return 0;
}

// ============================================
// 存量指标服务（快照数据，不受 period 影响）
// ============================================

export async function getSnapshotMetrics(): Promise<SnapshotMetrics> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 并行查询所有存量指标
  const [
    totalUsersResult,
    activeUsersResult,
    todayActiveUsersResult,
    planDistributionResult,
    activeSubscriptionsResult,
  ] = await Promise.all([
    // 总用户数
    db.select({ count: count() }).from(users),

    // 活跃用户数（最近 7 天）
    db
      .select({ count: count() })
      .from(users)
      .where(and(ne(users.banned, true), gte(users.lastActiveAt, sevenDaysAgo))),

    // 今日活跃用户数
    db
      .select({ count: count() })
      .from(users)
      .where(and(ne(users.banned, true), gte(users.lastActiveAt, todayStart))),

    // 套餐分布（从 user_extensions 表）
    db
      .select({
        currentPlan: userExtensions.currentPlan,
        count: count(),
      })
      .from(userExtensions)
      .groupBy(userExtensions.currentPlan),

    // 活跃订阅数（当前有效的订阅）
    db
      .select({ count: count() })
      .from(userSubscriptionHistory)
      .where(
        and(
          eq(userSubscriptionHistory.isActive, true),
          eq(userSubscriptionHistory.status, 'active'),
          or(
            sql`user_subscription_history.ended_at IS NULL`,
            gte(userSubscriptionHistory.endedAt, now),
          ),
        ),
      ),
  ]);

  // 构建套餐分布数据（基于 subscription_plans 表）
  const planDistribution = { free: 0, lite: 0, pro: 0, ultra: 0 };

  // 将 current_plan 映射到订阅方案类型
  const planMapping: Record<string, 'free' | 'lite' | 'pro' | 'ultra'> = {
    'free': 'free',
    'lite': 'lite',
    'pro': 'pro',
    'ultra': 'ultra',
    // 兼容旧值
    'basic': 'lite',      // basic -> lite
    'enterprise': 'ultra', // enterprise -> ultra
  };

  planDistributionResult.forEach((result) => {
    const currentPlanLower = (result.currentPlan || 'free').toLowerCase();
    const planType = planMapping[currentPlanLower] || 'free';
    planDistribution[planType] += Number(result.count);
  });

  // 计算 MRR（从活跃订阅计算）
  const activeSubs = await db
    .select({
      planId: userSubscriptionHistory.planId,
      billingInterval: userSubscriptionHistory.billingInterval,
    })
    .from(userSubscriptionHistory)
    .where(
      and(
        eq(userSubscriptionHistory.isActive, true),
        eq(userSubscriptionHistory.status, 'active'),
        or(
          sql`user_subscription_history.ended_at IS NULL`,
          gte(userSubscriptionHistory.endedAt, now),
        ),
      ),
    );

  // 获取套餐价格信息
  const planIds = activeSubs.map((sub) => sub.planId).filter(Boolean) as string[];
  const plansData =
    planIds.length > 0
      ? await db
          .select({
            id: subscriptionPlans.id,
            monthlyPrice: subscriptionPlans.monthlyPrice,
            yearlyPrice: subscriptionPlans.yearlyPrice,
          })
          .from(subscriptionPlans)
          .where(inArray(subscriptionPlans.id, planIds))
      : [];

  const planPriceMap = new Map(
    plansData.map((plan) => [
      plan.id,
      {
        monthly: Number(plan.monthlyPrice),
        yearly: Number(plan.yearlyPrice || 0),
      },
    ]),
  );

  // 计算 MRR
  let mrr = 0;
  activeSubs.forEach((sub) => {
    const prices = planPriceMap.get(sub.planId || '');
    if (prices) {
      if (sub.billingInterval === 'year') {
        mrr += prices.yearly / 12; // 年付按月均摊
      } else {
        mrr += prices.monthly;
      }
    }
  });

  const arr = mrr * 12;

  return {
    totalUsers: totalUsersResult[0]?.count || 0,
    activeUsers: activeUsersResult[0]?.count || 0,
    todayActiveUsers: todayActiveUsersResult[0]?.count || 0,
    activeSubscriptions: activeSubscriptionsResult[0]?.count || 0,
    mrr: mrr / 100, // 转换为元
    arr: arr / 100, // 转换为元
    planDistribution,
  };
}

// ============================================
// 流量指标服务（受 period 影响）
// ============================================

export async function getPeriodMetrics(period: DashboardPeriod): Promise<PeriodMetrics> {
  const { startDate, endDate } = getDateRange(period);

  // 并行查询所有流量指标
  const [newUsersResult, apiCallsResult] = await Promise.all([
    // 新增用户数
    db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, startDate)),

    // API 调用统计（使用 raw SQL，需要转换为 ISO 字符串）
    db.execute(
      sql`
        SELECT
          COUNT(*) as total_calls,
          COALESCE(SUM(
            COALESCE((metadata->>'tokens')::int, 0) +
            COALESCE((metadata->>'inputTokens')::int, 0) +
            COALESCE((metadata->>'outputTokens')::int, 0)
          ), 0) as total_tokens
        FROM messages
        WHERE role = 'assistant'
          AND created_at >= ${startDate.toISOString()}
          AND created_at < ${endDate.toISOString()}
      `,
    ),
  ]);

  // 订阅变化统计（使用 raw SQL 查询）
  const subscriptionStatsResult = await db.execute(
    sql`
      SELECT
        COUNT(*) FILTER (WHERE started_at >= ${startDate.toISOString()} AND started_at < ${endDate.toISOString()}) as new_subs,
        COUNT(*) FILTER (WHERE ended_at >= ${startDate.toISOString()} AND ended_at < ${endDate.toISOString()} AND status IN ('canceled', 'expired')) as churned_subs
      FROM user_subscription_history
    `,
  );

  // 收入统计（指定时间段内的新收入，使用 raw SQL）
  const revenueResult = await db.execute(
    sql`
      SELECT COALESCE(SUM(price), 0) as total_revenue
      FROM user_subscription_history
      WHERE started_at >= ${startDate.toISOString()}
        AND started_at < ${endDate.toISOString()}
        AND status = 'active'
    `,
  );

  // 获取收入趋势（按天聚合）
  const revenueTrend = await getRevenueTrend(startDate, endDate);

  // 获取用户增长趋势（按天聚合）
  const userGrowthTrend = await getUserGrowthTrend(startDate, endDate);

  return {
    period,
    totalRevenue: Number((revenueResult as any)[0]?.total_revenue || 0) / 100, // 转换为元
    newSubscriptions: Number(subscriptionStatsResult[0]?.new_subs || 0),
    churnedSubscriptions: Number(subscriptionStatsResult[0]?.churned_subs || 0),
    newUsers: newUsersResult[0]?.count || 0,
    totalApiCalls: Number((apiCallsResult as any)[0]?.total_calls || 0),
    totalTokens: Number((apiCallsResult as any)[0]?.total_tokens || 0),
    revenueTrend,
    userGrowthTrend,
  };
}

// 获取收入趋势（按天聚合）
async function getRevenueTrend(
  startDate: Date,
  endDate: Date,
): Promise<Array<{ date: string; revenue: number }>> {
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const trend: Array<{ date: string; revenue: number }> = [];

  for (let i = 0; i < daysDiff; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const result = await db.execute(
      sql`
        SELECT COALESCE(SUM(price), 0) as daily_revenue
        FROM user_subscription_history
        WHERE started_at >= ${startOfDay.toISOString()}
          AND started_at < ${endOfDay.toISOString()}
          AND status = 'active'
      `,
    );

    trend.push({
      date: startOfDay.toISOString().split('T')[0],
      revenue: Number((result as any)[0]?.daily_revenue || 0) / 100, // 转换为元
    });
  }

  return trend;
}

// 获取用户增长趋势（按天聚合）
async function getUserGrowthTrend(
  startDate: Date,
  endDate: Date,
): Promise<Array<{ date: string; newUsers: number; activeUsers: number }>> {
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const trend: Array<{ date: string; newUsers: number; activeUsers: number }> = [];

  for (let i = 0; i < daysDiff; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const sevenDaysBefore = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [newUsersResult, activeUsersResult] = await Promise.all([
      // 当日新增用户
      db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            gte(users.createdAt, startOfDay),
            sql`${users.createdAt} < ${endOfDay.toISOString()}`,
          ),
        ),
      // 当日活跃用户（最近 7 天有活动）
      db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            ne(users.banned, true),
            gte(users.lastActiveAt, sevenDaysBefore),
            sql`${users.lastActiveAt} < ${endOfDay.toISOString()}`,
          ),
        ),
    ]);

    trend.push({
      date: startOfDay.toISOString().split('T')[0],
      newUsers: newUsersResult[0]?.count || 0,
      activeUsers: activeUsersResult[0]?.count || 0,
    });
  }

  return trend;
}

// ============================================
// AI 使用统计服务
// ============================================

export async function getAIUsageStats(period: DashboardPeriod): Promise<AIUsageStats> {
  const { startDate, endDate } = getDateRange(period);
  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();

  // 并行查询所有 AI 使用统计（使用 raw SQL）
  const [byProviderResult, topModelsResult, hourlyActivityResult] = await Promise.all([
    // 按供应商分组统计
    db.execute(
      sql`
        SELECT
          provider,
          COUNT(*) as calls
        FROM messages
        WHERE role = 'assistant'
          AND created_at >= ${startDateStr}
          AND created_at < ${endDateStr}
        GROUP BY provider
        ORDER BY calls DESC
      `,
    ),

    // 热门模型 TOP 10
    db.execute(
      sql`
        SELECT
          model,
          provider,
          COUNT(*) as calls
        FROM messages
        WHERE role = 'assistant'
          AND created_at >= ${startDateStr}
          AND created_at < ${endDateStr}
        GROUP BY model, provider
        ORDER BY calls DESC
        LIMIT 10
      `,
    ),

    // 每小时活跃度（0-23 小时）
    db.execute(
      sql`
        SELECT
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as messages
        FROM messages
        WHERE role = 'assistant'
          AND created_at >= ${startDateStr}
          AND created_at < ${endDateStr}
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY EXTRACT(HOUR FROM created_at)
      `,
    ),
  ]);

  // 获取热门模型的 token 数据（需要额外查询）
  const tokensData = await db.execute(
    sql`
      SELECT
        model,
        provider,
        COALESCE(SUM(
          COALESCE((metadata->>'tokens')::int, 0) +
          COALESCE((metadata->>'inputTokens')::int, 0) +
          COALESCE((metadata->>'outputTokens')::int, 0)
        ), 0) as tokens
      FROM messages
      WHERE role = 'assistant'
        AND created_at >= ${startDateStr}
        AND created_at < ${endDateStr}
      GROUP BY model, provider
    `,
  );

  // 创建 token 数据映射
  const tokensMap = new Map<string, number>();
  (tokensData as any[]).forEach((item) => {
    if (item.model && item.provider) {
      tokensMap.set(`${item.model}-${item.provider}`, Number(item.tokens) || 0);
    }
  });

  // 计算总调用数（用于计算百分比）
  const totalCalls = (byProviderResult as any[]).reduce((sum, item) => sum + Number(item.calls), 0);

  // 构建按供应商分组的数据
  const byProvider = (byProviderResult as any[])
    .filter((item) => item.provider)
    .map((item) => ({
      provider: item.provider,
      calls: Number(item.calls),
      percentage: totalCalls > 0 ? (Number(item.calls) / totalCalls) * 100 : 0,
    }));

  // 构建热门模型数据
  const topModels = (topModelsResult as any[])
    .filter((item) => item.model && item.provider)
    .map((item) => ({
      model: item.model,
      provider: item.provider,
      calls: Number(item.calls),
      tokens: tokensMap.get(`${item.model}-${item.provider}`) || 0,
    }));

  // 构建每小时活跃度数据（确保 0-23 小时都有数据）
  const hourlyActivityMap = new Map(
    (hourlyActivityResult as any[]).map((item) => [Math.floor(Number(item.hour)), Number(item.messages)]),
  );

  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    messages: hourlyActivityMap.get(hour) || 0,
  }));

  return {
    byProvider,
    topModels,
    hourlyActivity,
  };
}

// ============================================
// 用户留存率队列服务
// ============================================

export async function getRetentionCohorts(days: number = 30): Promise<RetentionCohort[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 获取队列数据（按注册日期分组）
  const cohortsResult = await db
    .select({
      cohortDate: sql<string>`DATE(${users.createdAt})`,
      users: count(),
    })
    .from(users)
    .where(gte(users.createdAt, startDate))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(desc(sql`DATE(${users.createdAt})`));

  // 计算留存率
  const cohorts: RetentionCohort[] = [];

  for (const cohort of cohortsResult) {
    const cohortDateStr = cohort.cohortDate + 'T00:00:00Z';

    // D1 留存：注册后 1 天内再次活跃的用户
    const d1Result = await db.execute(
      sql`
        SELECT COUNT(*) as count
        FROM users
        WHERE DATE(created_at) = ${cohort.cohortDate}
          AND last_active_at >= created_at + INTERVAL '1 day'
      `,
    );

    // D7 留存：注册后 7 天内再次活跃的用户
    const d7Result = await db.execute(
      sql`
        SELECT COUNT(*) as count
        FROM users
        WHERE DATE(created_at) = ${cohort.cohortDate}
          AND last_active_at >= created_at + INTERVAL '7 days'
      `,
    );

    // D30 留存：注册后 30 天内再次活跃的用户
    const d30Result = await db.execute(
      sql`
        SELECT COUNT(*) as count
        FROM users
        WHERE DATE(created_at) = ${cohort.cohortDate}
          AND last_active_at >= created_at + INTERVAL '30 days'
      `,
    );

    const totalUsers = Number(cohort.users);
    cohorts.push({
      date: cohort.cohortDate,
      users: totalUsers,
      d1: totalUsers > 0 ? (Number((d1Result as any)[0]?.count || 0) / totalUsers) * 100 : 0,
      d7: totalUsers > 0 ? (Number((d7Result as any)[0]?.count || 0) / totalUsers) * 100 : 0,
      d30: totalUsers > 0 ? (Number((d30Result as any)[0]?.count || 0) / totalUsers) * 100 : 0,
    });
  }

  return cohorts;
}
