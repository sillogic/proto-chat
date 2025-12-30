import { db } from '../config/database';
import { userExtensions, UserExtension } from '../db/user-extensions-schema';
import { eq, sql } from 'drizzle-orm';

export class UsageService {

  // 获取用户月度使用统计（基于现有业务表）
  async getUserMonthlyUsage(userId: string) {
    // 获取用户订阅信息以确定计费周期
    const userExt = await this.getUserExtension(userId);
    const startValue = userExt?.createdAt || new Date();
    const startDate = new Date(startValue);
    const now = new Date();

    // Calculate the billing cycle start
    let cycleStart = new Date(now.getFullYear(), now.getMonth(), startDate.getDate(), startDate.getHours(), startDate.getMinutes());
    if (cycleStart > now) {
      cycleStart.setMonth(cycleStart.getMonth() - 1);
    }
    const cycleStartStr = cycleStart.toISOString();

    // Run all stats queries in parallel
    const [messageStats, sessionStats, fileStats] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*) as message_count,
          COUNT(CASE WHEN role != 'user' THEN 1 END) as assistant_messages
        FROM messages 
        WHERE user_id = ${userId} 
        AND created_at >= ${cycleStartStr}
      `),
      db.execute(sql`
        SELECT COUNT(*) as session_count 
        FROM sessions 
        WHERE user_id = ${userId} 
        AND created_at >= ${cycleStartStr}
      `),
      db.execute(sql`
        SELECT 
          COUNT(*) as file_count,
          COALESCE(SUM(size), 0) as total_size
        FROM files 
        WHERE user_id = ${userId}
      `)
    ]);

    // 计算重置时间 (距离下一个周期的开始)
    // 下一个周期的月份
    const nextMonth = new Date(cycleStart);
    // 判断是否为年付计划
    const isYearly = userExt?.currentPlan?.toLowerCase().includes('yearly');

    if (isYearly) {
      nextMonth.setFullYear(nextMonth.getFullYear() + 1);
    } else {
      nextMonth.setMonth(nextMonth.getMonth() + 1);
    }

    // 核心：处理月份长度不一导致的日期溢出（如1月31日订，2月没有31日）
    // 获取目标月的天数
    const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(startDate.getDate(), daysInNextMonth);

    const nextReset = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay, startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());

    const timeDiff = nextReset.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const fileCount = parseInt((fileStats[0] as any)?.file_count || '0');
    const totalSize = parseInt((fileStats[0] as any)?.total_size || '0');
    const assistantMessages = parseInt((messageStats[0] as any)?.assistant_messages || '0');
    const messageCount = parseInt((messageStats[0] as any)?.message_count || '0');
    const sessionCount = parseInt((sessionStats[0] as any)?.session_count || '0');

    return {
      files: {
        count: fileCount,
        totalSize: totalSize,
        totalSizeKB: Math.round(totalSize / 1024),
        totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100
      },
      messages: {
        assistantMessages: assistantMessages,
        count: messageCount
      },
      resetCountdown: {
        days,
        hours,
        label: `${days} 天 ${hours} 小时`,
        nextResetDate: nextReset.toLocaleString('zh-CN', {
          day: '2-digit',
          hour: '2-digit',
          hour12: false,
          minute: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      },
      sessions: {
        count: sessionCount
      },
      userExtension: userExt,
      vectors: {
        count: 0 // Vector stats temporarily disabled for stability
      }
    };
  }

  // 检查用户限制
  async checkUserLimits(userId: string) {
    const userExtension = await this.getUserExtension(userId);
    if (!userExtension) {
      return { allowed: true, message: 'User not found' };
    }

    const currentUsage = await this.getUserMonthlyUsage(userId);
    const limits = [];

    // 检查存储限制
    const storageLimit = userExtension.monthlyStorageLimit || 1024;
    if (storageLimit > 0) {
      const usagePercent = (currentUsage.files.totalSizeMB / storageLimit) * 100;
      if (usagePercent >= 100) {
        limits.push({
          current: currentUsage.files.totalSizeMB,
          exceeded: true,
          limit: storageLimit,
          percentage: Math.round(usagePercent),
          type: 'storage_limit'
        });
      } else if (usagePercent >= 90) {
        limits.push({
          current: currentUsage.files.totalSizeMB,
          limit: storageLimit,
          percentage: Math.round(usagePercent),
          type: 'storage_limit',
          warning: true
        });
      }
    }

    return {
      allowed: !limits.some(l => l.exceeded),
      currentUsage,
      limits: limits.filter(l => l.exceeded || l.warning),
      userExtension
    };
  }

  // 获取用户扩展信息
  // 如果不存在，则创建一个默认的
  async getUserExtension(userId: string): Promise<UserExtension | null> {
    try {
      const result = await db
        .select()
        .from(userExtensions)
        .where(eq(userExtensions.userId, userId))
        .limit(1);

      if (result && result.length > 0) {
        return result[0];
      }
      return null;
    } catch (error) {
      console.error('Error getting user extension:', error);
      return null;
    }
  }

  // 创建或更新用户扩展信息
  async upsertUserExtension(userId: string, data: Partial<UserExtension>) {
    const existing = await this.getUserExtension(userId);
    const now = new Date();

    if (existing) {
      // 更新
      await db
        .update(userExtensions)
        .set({ ...data, updatedAt: now })
        .where(eq(userExtensions.userId, userId));
    } else {
      // 创建
      await db.insert(userExtensions).values({
        userId,
        ...data,
        createdAt: now,
        updatedAt: now
      });
    }

    return this.getUserExtension(userId);
  }

  // 重置月度使用量（在月初调用）
  async resetMonthlyUsage(userId: string) {
    const currentUsage = await this.getUserMonthlyUsage(userId);
    const now = new Date();

    await db
      .update(userExtensions)
      .set({
        currentApiCallsUsed: currentUsage.sessions.count,
        currentTokensUsed: currentUsage.messages.assistantMessages,
        lastUsageReset: now,
        updatedAt: now
      })
      .where(eq(userExtensions.userId, userId));

    return true;
  }

  // 更新用户套餐并赠送积分
  async updateUserPlan(userId: string, planData: {
    currentPlan: string;
    features: any;
    monthlyApiCallsLimit: number;
    monthlyStorageLimit: number;
    monthlyTokenLimit: number;
    planExpiresAt?: Date;
    planId?: string;
  }) {
    const { planId, ...rest } = planData;
    const now = new Date();

    try {
      return await db.transaction(async (tx) => {
        // 1. 更新扩展表
        await tx.insert(userExtensions)
          .values({
            ...rest,
            createdAt: now,
            updatedAt: now,
            userId,
          })
          .onConflictDoUpdate({
            set: {
              ...rest,
              updatedAt: now,
            },
            target: userExtensions.userId,
          });

        // 2. 如果提供了 planId，赠送积分并记录流水
        if (planId) {
          const { subscriptionPlans } = await import('../db/subscription-schema');

          const plan = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);

          if (plan && plan.length > 0) {
            const planDataRecord = plan[0] as any;
            const creditsToGrant = planDataRecord.credits;
            const storageToSet = planDataRecord.storageLimit;

            // 更新用户配额限制
            await tx.update(userExtensions)
              .set({
                monthlyStorageLimit: storageToSet,
                monthlyTokenLimit: parseInt(creditsToGrant),
                updatedAt: now
              })
              .where(eq(userExtensions.userId, userId));

            if (parseFloat(creditsToGrant) > 0) {
              const { userBalances, userTransactions } = await import('../db/credit-schema');

              // 更新余额
              await tx.insert(userBalances)
                .values({
                  balance: creditsToGrant,
                  updatedAt: now,
                  userId
                })
                .onConflictDoUpdate({
                  set: {
                    balance: creditsToGrant,
                    updatedAt: now
                  },
                  target: userBalances.userId
                });

              // 记录交易流水
              await tx.insert(userTransactions).values({
                amount: creditsToGrant,
                category: 'PLAN_RENEWAL',
                createdAt: now,
                description: `Plan Subscription Grant: ${planDataRecord.name}`,
                id: 'tx_sub_' + Math.random().toString(36).slice(2, 12),
                metadata: {
                  credits: creditsToGrant,
                  currency: planDataRecord.currency,
                  expiresAt: planData.planExpiresAt,
                  planId: planDataRecord.id,
                  planName: planDataRecord.name,
                  price: planDataRecord.price
                },
                type: 'SUBSCRIPTION_GRANT',
                updatedAt: now,
                userId,
              } as any);

              console.log(`[Atomic] Granted ${creditsToGrant} credits to user ${userId} for plan ${planDataRecord.name}`);
            }
          }
        }
        return true;
      });
    } catch (error) {
      console.error('Failed to update user plan atomically:', error);
      return false;
    }
  }

  // 获取所有用户的用量统计（管理员用）
  async getAllUsersUsage(limit: number = 20, offset: number = 0) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString();

    // 查询用户及其用量统计
    const query = sql`
      SELECT
          u.id,
          u.username,
          u.full_name,
          u.email,
          u.created_at,
          u.last_active_at,
          ue.current_plan,
          ue.monthly_token_limit,
          ue.monthly_api_calls_limit,
          ue.monthly_storage_limit,
          ue.is_suspended,
          COALESCE(msg_count, 0) as monthly_messages,
          COALESCE(session_count, 0) as monthly_sessions,
          COALESCE(file_count, 0) as monthly_files,
          COALESCE(total_size, 0) as monthly_storage_used
      FROM users u
      LEFT JOIN user_extensions ue ON u.id = ue.user_id
      LEFT JOIN (
          SELECT user_id, COUNT(*) as msg_count
          FROM messages
          WHERE created_at >= ${monthStartStr}
          GROUP BY user_id
      ) msg_stats ON u.id = msg_stats.user_id
      LEFT JOIN (
          SELECT user_id, COUNT(*) as session_count
          FROM sessions
          WHERE created_at >= ${monthStartStr}
          GROUP BY user_id
      ) session_stats ON u.id = session_stats.user_id
      LEFT JOIN (
          SELECT user_id, COUNT(*) as file_count, COALESCE(SUM(size), 0) as total_size
          FROM files
          WHERE created_at >= ${monthStartStr}
          GROUP BY user_id
      ) file_stats ON u.id = file_stats.user_id
      WHERE u.email != 'admin@system.local'
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await db.execute(query);

    // 计算总量
    const totalQuery = sql`SELECT COUNT(*) as total FROM users WHERE email != 'admin@system.local'`;
    const totalResult = await db.execute(totalQuery);

    return {
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      total: parseInt((totalResult[0] as any)?.total || '0'),
      users: result as any[]
    };
  }
  // 获取系统级用量统计
  async getSystemUsageStats(localDate: Date) {
    // 确定查询的时间范围（当月 1 号到下月 1 号）
    const startOfPeriod = new Date(localDate.getFullYear(), localDate.getMonth(), 1);
    const endOfPeriod = new Date(localDate.getFullYear(), localDate.getMonth() + 1, 1);
    const startOfPeriodStr = startOfPeriod.toISOString();

    // 1. 获取每日趋势 (按模型)
    const dailyTrend = await db.execute(sql`
      SELECT 
        TO_CHAR(m.created_at, 'YYYY-MM-DD') as date,
        m.model,
        SUM((COALESCE(m.metadata->>'totalInputTokens', '0'))::int) as "totalInputTokens",
        SUM((COALESCE(m.metadata->>'totalOutputTokens', '0'))::int) as "totalOutputTokens",
        SUM((COALESCE(m.metadata->>'totalInputTokens', '0'))::int + (COALESCE(m.metadata->>'totalOutputTokens', '0'))::int) as "totalTokens"
      FROM messages m
      WHERE m.role = 'assistant'
      AND m.created_at >= ${startOfPeriodStr}
      AND m.created_at < ${endOfPeriod.toISOString()}
      AND m.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
      GROUP BY TO_CHAR(m.created_at, 'YYYY-MM-DD'), m.model
      ORDER BY date ASC
    `);

    // 2. 获取当月模型/供应商聚合统计 (包含成本估算)
    const aggregatedStats = await db.execute(sql`
      SELECT
        m.model,
        m.provider,
        SUM((COALESCE(m.metadata->>'totalInputTokens', '0'))::int) as "totalInputTokens",
        SUM((COALESCE(m.metadata->>'totalOutputTokens', '0'))::int) as "totalOutputTokens",
        SUM((COALESCE(m.metadata->>'totalInputTokens', '0'))::int + (COALESCE(m.metadata->>'totalOutputTokens', '0'))::int) as "totalTokens",
        MAX(mp.input_price) as "inputPrice",
        MAX(mp.output_price) as "outputPrice",
        MAX(mp.per_request_price) as "perRequestPrice",
        COUNT(*) as "requestCount"
      FROM messages m
      LEFT JOIN model_pricings mp ON m.model = mp.model AND m.provider = mp.provider
      WHERE m.role = 'assistant'
      AND m.created_at >= ${startOfPeriodStr}
      AND m.created_at < ${endOfPeriod.toISOString()}
      GROUP BY m.model, m.provider
      ORDER BY "totalTokens" DESC
    `);

    // 3. 获取全系统文件存储统计
    const storageStats = await db.execute(sql`
      SELECT 
          SUM(size) as "totalSize",
        COUNT(*) as "fileCount"
      FROM files
    `);

    // 4. 获取全系统向量存储统计
    const vectorStats = await db.execute(sql`
      SELECT COUNT(*) as "vectorCount" FROM embeddings
    `);

    // 5. 后处理：计算成本并生成 modelStats 和 providerStats
    let totalCost = 0;
    let totalTokens = 0;
    let totalRequests = 0;

    // 预处理每条记录的成本
    const enrichedStats = (aggregatedStats as any[]).map(item => {
      const inputPrice = parseFloat(item.inputPrice || '0');
      const outputPrice = parseFloat(item.outputPrice || '0');
      const perRequestPrice = parseFloat(item.perRequestPrice || '0');

      const inputCost = (item.totalInputTokens / 1_000_000) * inputPrice;
      const outputCost = (item.totalOutputTokens / 1_000_000) * outputPrice;
      const requestCost = item.requestCount * perRequestPrice;
      const cost = inputCost + outputCost + requestCost;

      totalCost += cost;
      totalTokens += parseInt(item.totalTokens);
      totalRequests += parseInt(item.requestCount);

      return {
        ...item,
        cost,
      };
    });

    // 聚合 Model Stats
    const modelStatsMap = new Map<string, any>();
    for (const item of enrichedStats) {
      if (!modelStatsMap.has(item.model)) {
        modelStatsMap.set(item.model, {
          cost: 0,
          model: item.model,
          requestCount: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0
        });
      }
      const existing = modelStatsMap.get(item.model);
      existing.totalInputTokens += parseInt(item.totalInputTokens);
      existing.totalOutputTokens += parseInt(item.totalOutputTokens);
      existing.totalTokens += parseInt(item.totalTokens);
      existing.requestCount += parseInt(item.requestCount);
      existing.cost += item.cost;
    }
    const modelStats = Array.from(modelStatsMap.values()).map(m => ({ ...m, cost: m.cost.toFixed(6) }));

    // 聚合 Provider Stats
    const providerStatsMap = new Map<string, any>();
    for (const item of enrichedStats) {
      const provider = item.provider || 'unknown';
      if (!providerStatsMap.has(provider)) {
        providerStatsMap.set(provider, {
          cost: 0,
          provider: provider,
          requestCount: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0
        });
      }
      const existing = providerStatsMap.get(provider);
      existing.totalInputTokens += parseInt(item.totalInputTokens);
      existing.totalOutputTokens += parseInt(item.totalOutputTokens);
      existing.totalTokens += parseInt(item.totalTokens);
      existing.requestCount += parseInt(item.requestCount);
      existing.cost += item.cost;
    }
    const providerStats = Array.from(providerStatsMap.values()).map(p => ({ ...p, cost: p.cost.toFixed(6) }));

    // Calculate storage in MB or GB
    const totalSizeBytes = parseInt((storageStats[0] as any)?.totalSize || '0');
    // For display, return bytes, frontend can format

    return {
      dailyTrend: dailyTrend as any[],
      modelStats: modelStats.sort((a, b) => b.totalTokens - a.totalTokens),
      overview: {
        fileCount: parseInt((storageStats[0] as any)?.fileCount || '0'),
        requestCount: totalRequests,
        totalCost: totalCost.toFixed(4),
        totalStorageBytes: totalSizeBytes,
        totalTokens,
        vectorCount: parseInt((vectorStats[0] as any)?.vectorCount || '0')
      },
      providerStats: providerStats.sort((a, b) => b.totalTokens - a.totalTokens)
    };
  }
}

export const usageService = new UsageService();