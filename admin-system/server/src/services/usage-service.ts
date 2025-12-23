import { db } from '../config/database';
import { userExtensions, UserExtension } from '../db/user-extensions-schema';
import { eq, sql } from 'drizzle-orm';


export class UsageService {

  // 获取用户月度使用统计（基于现有业务表）
  async getUserMonthlyUsage(userId: string) {
    // 获取用户订阅信息以确定计费周期
    const userExt = await this.getUserExtension(userId);
    let cycleStart = new Date();
    cycleStart.setDate(1);
    cycleStart.setHours(0, 0, 0, 0);

    if (userExt && userExt.planStartedAt) {
      const start = new Date(userExt.planStartedAt);
      const now = new Date();
      // 计算本月的计费日
      cycleStart = new Date(now.getFullYear(), now.getMonth(), start.getDate(), start.getHours(), start.getMinutes());
      // 如果还没到本月的计费日，则计费起点在上个月
      if (cycleStart > now) {
        cycleStart.setMonth(cycleStart.getMonth() - 1);
      }
    }
    const cycleStartStr = cycleStart.toISOString();

    // 查询消息统计
    const messageStats = await db.execute(sql`
      SELECT
        COUNT(*) as message_count,
        COUNT(CASE WHEN role != 'user' THEN 1 END) as assistant_messages
      FROM messages
      WHERE user_id = ${userId}
      AND created_at >= ${cycleStartStr}
    `);

    // 查询会话统计
    const sessionStats = await db.execute(sql`
      SELECT COUNT(*) as session_count
      FROM sessions
      WHERE user_id = ${userId}
      AND created_at >= ${cycleStartStr}
    `);

    // 查询文件统计
    const fileStats = await db.execute(sql`
      SELECT
        COUNT(*) as file_count,
        COALESCE(SUM(size), 0) as total_size
      FROM files
      WHERE user_id = ${userId}
    `);

    // 查询向量统计 (基于 embeddings 表)
    const vectorStats = await db.execute(sql`
      SELECT COUNT(*) as vector_count
      FROM embeddings
      WHERE user_id = ${userId}
    `);

    // 计算重置时间 (距离下一个周期的开始)
    const now = new Date();
    // 基础重置逻辑：获取订阅起始日
    const start = userExt?.planStartedAt ? new Date(userExt.planStartedAt) : new Date();

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
    const targetDay = Math.min(start.getDate(), daysInNextMonth);

    const nextReset = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay, start.getHours(), start.getMinutes(), start.getSeconds());

    const timeDiff = nextReset.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return {
      files: {
        count: parseInt((fileStats[0] as any)?.file_count || '0'),
        totalSize: parseInt((fileStats[0] as any)?.total_size || '0'),
        totalSizeMB: Math.round(parseInt((fileStats[0] as any)?.total_size || '0') / 1024 / 1024)
      },
      messages: {
        assistantMessages: parseInt((messageStats[0] as any)?.assistant_messages || '0'),
        count: parseInt((messageStats[0] as any)?.message_count || '0')
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
        count: parseInt((sessionStats[0] as any)?.session_count || '0')
      },
      userExtension: userExt,
      vectors: {
        count: parseInt((vectorStats[0] as any)?.vector_count || '0')
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
    if (userExtension.monthlyStorageLimit > 0) {
      const usagePercent = (currentUsage.files.totalSizeMB / userExtension.monthlyStorageLimit) * 100;
      if (usagePercent >= 100) {
        limits.push({
          current: currentUsage.files.totalSizeMB,
          exceeded: true,
          limit: userExtension.monthlyStorageLimit,
          percentage: Math.round(usagePercent),
          type: 'storage_limit'
        });
      } else if (usagePercent >= 90) {
        limits.push({
          current: currentUsage.files.totalSizeMB,
          limit: userExtension.monthlyStorageLimit,
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
    const result = await db
      .select()
      .from(userExtensions)
      .where(eq(userExtensions.userId, userId))
      .limit(1);

    if (result && result.length > 0) {
      return result[0];
    }

    // 不存在，创建默认记录
    try {
      const defaultExt: Partial<UserExtension> = {
        currentPlan: 'free',
        features: {
          advancedModel: false,
          apiAccess: false,
          basicChat: true,
          customAgents: false,
          exportHistory: true,
          fileUpload: true,
          prioritySupport: false,
        },
        monthlyApiCallsLimit: 0,
        monthlyStorageLimit: 1024,
        monthlyTokenLimit: 0,
        monthlyVectorLimit: 100,
        userId,
      };

      const newRec = await db.insert(userExtensions).values(defaultExt as any).returning();
      return newRec[0];
    } catch (error) {
      console.error('Error auto-creating user extension:', error);
      // Fallback: return null or re-throw, but for "get" typically return null is safer if creation fails
      // However, since we promised a return, let's try to return what we can
      return null;
    }
  }

  // 创建或更新用户扩展信息
  async upsertUserExtension(userId: string, data: Partial<UserExtension>) {
    const existing = await this.getUserExtension(userId);

    if (existing) {
      // 更新
      await db
        .update(userExtensions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userExtensions.userId, userId));
    } else {
      // 创建
      await db.insert(userExtensions).values({
        userId,
        ...data
      });
    }

    return this.getUserExtension(userId);
  }

  // 重置月度使用量（在月初调用）
  async resetMonthlyUsage(userId: string) {
    const currentUsage = await this.getUserMonthlyUsage(userId);

    await db
      .update(userExtensions)
      .set({
        // 更新为实际使用量
        currentApiCallsUsed: currentUsage.sessions.count,
        currentStorageUsed: currentUsage.files.totalSizeMB,
        currentTokensUsed: currentUsage.messages.assistantMessages,
        lastUsageReset: new Date(),
        updatedAt: new Date()
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
    // Optional plan ID to lookup credits
    planExpiresAt?: Date;
    planId?: string;
  }) {
    const { planId, ...rest } = planData;
    const now = new Date(); // 共享同一时刻，确保 State(planStartedAt) 与 Log(createdAt) 物理对齐

    try {
      return await db.transaction(async (tx) => {
        // 1. 更新扩展表 (作为“当前状态”)
        await tx.insert(userExtensions)
          .values({
            ...rest,
            planStartedAt: now,
            updatedAt: now,
            userId,
          })
          .onConflictDoUpdate({
            set: {
              ...rest,
              planStartedAt: now,
              updatedAt: now,
            },
            target: userExtensions.userId,
          });

        // 2. 如果提供了 planId，尝试赠送积分并记录流水 (作为“审计日志”)
        if (planId) {
          const { subscriptionPlans } = await import('../db/subscription-schema');
          const { userTransactions } = await import('../db/credit-schema');

          const plan = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);

          if (plan && plan.length > 0) {
            const planDataRecord = plan[0] as any;
            const creditsToGrant = planDataRecord.credits;
            const storageToSet = planDataRecord.storageLimit;
            const vectorsToSet = planDataRecord.vectorLimit;

            // 更新用户配额限制
            await tx.update(userExtensions)
              .set({
                monthlyStorageLimit: storageToSet,
                monthlyTokenLimit: parseInt(creditsToGrant),
                monthlyVectorLimit: vectorsToSet,
                updatedAt: now
              })
              .where(eq(userExtensions.userId, userId));

            if (parseFloat(creditsToGrant) > 0) {
              // 更新余额
              const { userBalances } = await import('../db/credit-schema');
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

              // 记录交易流水 (Log)
              await tx.insert(userTransactions).values({
                amount: creditsToGrant,
                category: 'PLAN_RENEWAL',
                createdAt: now, // 强制与 planStartedAt 一致
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
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await db.execute(query);

    // 计算总量
    const totalQuery = sql`SELECT COUNT(*) as total FROM users`;
    const totalResult = await db.execute(totalQuery);

    return {
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      total: parseInt(totalResult[0]?.total || '0'),
      users: result as any[]
    };
  }
}

export const usageService = new UsageService();