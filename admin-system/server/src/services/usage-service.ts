import { db } from '../config/database';
import { userExtensions, UserExtension, userSubscriptionHistory } from '../db/user-extensions-schema';
import { subscriptionPlans } from '../db/subscription-schema';
import { userBalances, userTransactions } from '../db/credit-schema';
import { eq, sql, and, or } from 'drizzle-orm';

export class UsageService {

  // 获取用户月度使用统计（基于关联的订阅计划动态获取限额）
  async getUserMonthlyUsage(userId: string) {
    const userExt = await this.getUserExtension(userId);

    // 1. 动态获取计划配置
    // 优先通过 planId 关联，如果没有则 fallback 到 currentPlan (slug)
    let planResult: any[] = [];
    if (userExt?.planId) {
      planResult = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, userExt.planId)).limit(1);
    }

    // 如果没有 planId 或没搜到，尝试用 slug
    if (planResult.length === 0) {
      planResult = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, userExt?.currentPlan || 'free')).limit(1);
    }

    const plan = planResult[0];

    // Detailed logging to debug plan discovery
    console.log(`[UsageService] getUserMonthlyUsage - userId: ${userId}`);
    console.log(`[UsageService] userExt - planId: ${userExt?.planId}, currentPlan: ${userExt?.currentPlan}`);
    console.log(`[UsageService] planFound: ${!!plan}, credits: ${plan?.credits}, slug: ${plan?.slug}`);

    // 2. 获取当前余额
    const balances = await db.select().from(userBalances).where(eq(userBalances.userId, userId)).limit(1);
    const balance = balances[0];

    const startValue = userExt?.createdAt || new Date();
    const startDate = new Date(startValue);
    const now = new Date();

    // 计费周期逻辑：免费套餐固定每月1号，其它套餐按创建日期
    let cycleStart: Date;
    const isFreePlan = plan?.slug === 'plan_free' || plan?.slug === 'free' || (!plan && (userExt?.currentPlan || 'free') === 'free');

    if (isFreePlan) {
      cycleStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      if (cycleStart > now) {
        cycleStart.setMonth(cycleStart.getMonth() - 1);
      }
    } else {
      cycleStart = new Date(now.getFullYear(), now.getMonth(), startDate.getDate(), startDate.getHours(), startDate.getMinutes());
      if (cycleStart > now) {
        cycleStart.setMonth(cycleStart.getMonth() - 1);
      }
    }
    const cycleStartStr = cycleStart.toISOString();

    // 3. 执行用量查询 (并行)
    const [messageStats, sessionStats, fileStats, transactionStats] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*) as message_count,
          COUNT(CASE WHEN role != 'user' THEN 1 END) as assistant_messages,
          SUM((COALESCE(metadata ->> 'totalInputTokens', '0'))::int) as total_input_tokens,
          SUM((COALESCE(metadata ->> 'totalOutputTokens', '0'))::int) as total_output_tokens
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
      `),
      db.execute(sql`
        SELECT 
          ABS(SUM(amount::numeric)) as total_consumed
        FROM user_transactions 
        WHERE user_id = ${userId}
        AND type = 'CONSUMPTION'
        AND created_at >= ${cycleStartStr}::timestamp
      `)
    ]);

    const totalConsumedFromTx = parseFloat((transactionStats[0] as any)?.total_consumed || '0');

    // 4. 计算重置时间
    let nextReset: Date;
    if (isFreePlan) {
      nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    } else {
      const nextMonth = new Date(cycleStart);
      // 使用 user_extensions.billingInterval 而不是 plan.interval
      const isYearly = userExt?.billingInterval === 'year';

      if (isYearly) {
        nextMonth.setFullYear(nextMonth.getFullYear() + 1);
      } else {
        nextMonth.setMonth(nextMonth.getMonth() + 1);
      }

      const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(startDate.getDate(), daysInNextMonth);
      nextReset = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay, startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
    }

    const timeDiff = nextReset.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const fileCount = parseInt((fileStats[0] as any)?.file_count || '0');
    const totalSize = parseInt((fileStats[0] as any)?.total_size || '0');
    const assistantMessages = parseInt((messageStats[0] as any)?.assistant_messages || '0');
    const totalInputTokens = parseInt((messageStats[0] as any)?.total_input_tokens || '0');
    const totalOutputTokens = parseInt((messageStats[0] as any)?.total_output_tokens || '0');
    const messageCount = parseInt((messageStats[0] as any)?.message_count || '0');
    const sessionCount = parseInt((sessionStats[0] as any)?.session_count || '0');

    if (!plan) {
      console.warn(`[UsageService] No plan found for user ${userId}. Fallback to zero-limits.`);
    }

    const planCredits = plan?.credits ? parseFloat(plan.credits) : 0;
    const planStorage = plan?.storageLimit ?? 0;
    const planVector = plan?.vectorLimit ?? 0;

    return {
      credits: {
        balance: parseFloat(balance?.balance || '0'),
        isUnlimited: balance?.isUnlimited || false,
        limit: planCredits,
        planName: plan?.name || userExt?.currentPlan || 'free',
        totalConsumed: totalConsumedFromTx, // 新增：从交易流水中统计的本月消耗
        totalPurchased: parseFloat(balance?.totalPurchased || '0')
      },
      files: {
        count: fileCount,
        limit: planStorage,
        totalSize: totalSize,
        totalSizeKB: Math.round(totalSize / 1024),
        totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100
      },
      messages: {
        assistantMessages: assistantMessages,
        count: messageCount,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens
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
        count: 0,
        limit: planVector
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

    // 检查存储限制 (MB)
    const storageLimit = currentUsage.files.limit;
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

    // 检查积分限制 (Credits)
    if (!currentUsage.credits.isUnlimited && currentUsage.credits.limit > 0) {
      if (currentUsage.credits.balance <= 0) {
        limits.push({
          current: currentUsage.credits.limit - currentUsage.credits.balance,
          exceeded: true,
          limit: currentUsage.credits.limit,
          type: 'credit_limit'
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
      await db
        .update(userExtensions)
        .set({ ...data, updatedAt: now })
        .where(eq(userExtensions.userId, userId));
    } else {
      await db.insert(userExtensions).values({
        userId,
        ...data,
        createdAt: now,
        updatedAt: now
      });
    }

    return this.getUserExtension(userId);
  }

  // 全局重置免费计划用户的积分（每月1号调用）
  async resetAllFreeBalances() {
    const now = new Date();
    try {
      // 1. 获取免费计划的实时配置
      const freePlans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, 'plan_free')).limit(1);
      if (freePlans.length === 0) {
        throw new Error('Critical Error: Free Plan configuration not found in subscription_plans table.');
      }
      const freePlan = freePlans[0];
      const creditsToSet = freePlan.credits;

      // 2. 找到所有当前是免费计划的用户 (通过 currentPlan 或 planId)
      const freeUsers = await db.select({ userId: userExtensions.userId })
        .from(userExtensions)
        .where(or(
          eq(userExtensions.currentPlan, 'plan_free'),
          eq(userExtensions.currentPlan, 'free'),
          eq(userExtensions.planId, freePlan.id)
        ));

      console.log(`[Cron] Dynamically resetting credits to ${creditsToSet} for ${freeUsers.length} free users...`);

      for (const user of freeUsers) {
        await db.transaction(async (tx) => {
          // 重置余额为计划额度
          await tx.insert(userBalances)
            .values({ balance: creditsToSet, updatedAt: now, userId: user.userId })
            .onConflictDoUpdate({ set: { balance: creditsToSet, updatedAt: now }, target: userBalances.userId });

          // 记录月度重置流水
          await tx.insert(userTransactions).values({
            amount: creditsToSet,
            category: 'MONTHLY_RESET',
            createdAt: now,
            description: `Monthly Free Credit Reset to ${creditsToSet}`,
            id: 'tx_reset_' + user.userId.slice(0, 8) + '_' + now.getTime(),
            metadata: { planId: freePlan.id, planName: freePlan.name },
            type: 'CREDIT_RESET',
            updatedAt: now,
            userId: user.userId,
          } as any);
        });
      }

      return { count: freeUsers.length, success: true };
    } catch (error) {
      console.error('Failed to reset free balances:', error);
      return { success: false };
    }
  }

  /**
   * 立即执行方案升级/变更 (立即生效)
   */
  async executeUpgrade(userId: string, targetPlanId: string, billingInterval: 'month' | 'year', customCategory?: string, orderNo?: string) {
    const now = new Date();
    try {
      return await db.transaction(async (tx) => {
        // 1. 获取目标计划
        const planResult = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, targetPlanId)).limit(1);
        const targetPlan = planResult[0];
        if (!targetPlan) throw new Error('Target plan not found');

        // 2. 计算过期时间 (根据 billingInterval)
        const expiresAt = new Date(now);
        if (billingInterval === 'year') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        // 3. 计算下次积分发放时间 (首次发放 = 1个月后)
        const nextCreditGrantAt = new Date(now);
        nextCreditGrantAt.setMonth(nextCreditGrantAt.getMonth() + 1);

        // 4. 根据 billingInterval 选择价格
        const price = billingInterval === 'year'
          ? (targetPlan.yearlyPrice ?? targetPlan.monthlyPrice * 12)
          : targetPlan.monthlyPrice;

        // 5. 更新 UserExtension (清除 nextPlanId, 设置 billingInterval 和 nextCreditGrantAt)
        await tx.insert(userExtensions)
          .values({
            currentPlan: targetPlan.slug,
            features: targetPlan.features,
            planExpiresAt: expiresAt,
            planId: targetPlan.id,
            nextPlanId: null,
            billingInterval: targetPlan.slug === 'free' ? null : billingInterval,
            nextCreditGrantAt: targetPlan.slug === 'free' ? null : nextCreditGrantAt,
            updatedAt: now,
            userId,
          })
          .onConflictDoUpdate({
            set: {
              currentPlan: targetPlan.slug,
              features: targetPlan.features,
              planExpiresAt: expiresAt,
              planId: targetPlan.id,
              nextPlanId: null,
              billingInterval: targetPlan.slug === 'free' ? null : billingInterval,
              nextCreditGrantAt: targetPlan.slug === 'free' ? null : nextCreditGrantAt,
              updatedAt: now,
            },
            target: userExtensions.userId,
          });

        // 6. 维护订阅历史 (关旧开新)
        await tx.update(userSubscriptionHistory)
          .set({ endedAt: now, isActive: false, status: 'upgraded' })
          .where(and(eq(userSubscriptionHistory.userId, userId), eq(userSubscriptionHistory.isActive, true)));

        await tx.insert(userSubscriptionHistory).values({
          features: targetPlan.features || {},
          isActive: true,
          status: 'active',
          autoRenew: true,
          planId: targetPlan.id,
          planName: targetPlan.name,
          planType: targetPlan.type,
          price,
          billingInterval: targetPlan.slug === 'free' ? null : billingInterval,
          orderNo,
          slug: targetPlan.slug,
          startedAt: now,
          userId,
        });

        // 7. 赠送积分 & 记录流水
        const credits = parseFloat(targetPlan.credits || '0');
        // 无论积分是否大于 0，方案变更都应该产生一条流水，记录账户重置
        await tx.insert(userBalances)
          .values({ balance: credits.toString(), updatedAt: now, userId })
          .onConflictDoUpdate({ set: { balance: credits.toString(), updatedAt: now }, target: userBalances.userId });

        await tx.insert(userTransactions).values({
          amount: credits,
          balanceAfter: credits.toString(),
          category: customCategory || 'UPGRADE_GRANT',
          createdAt: now,
          description: `Plan Switch: ${targetPlan.name} (${billingInterval})`,
          id: 'tx_pc_' + Math.random().toString(36).slice(2, 12),
          metadata: { planId: targetPlan.id, billingInterval, orderNo },
          type: 'SUBSCRIPTION_GRANT',
          updatedAt: now,
          userId,
        } as any);

        return true;
      });
    } catch (error) {
      console.error('Execute upgrade failed:', error);
      return false;
    }
  }

  /**
   * 预设方案变更 (降级或取消订阅 - 周期末生效)
   */
  async schedulePlanChange(userId: string, nextPlanId: string | null) {
    try {
      return await db.transaction(async (tx) => {
        // 1. 更新用户扩展表的预设
        await tx.update(userExtensions)
          .set({ nextPlanId, updatedAt: new Date() })
          .where(eq(userExtensions.userId, userId));

        // 2. 同步更新当前活跃契约的状态
        // 如果 nextPlanId 是免费方案或 null (取决于取消订阅的定义，通常设为 free 表示取消)，我们更新 autoRenew
        const isCanceling = !nextPlanId || nextPlanId.includes('free'); // 这里简单判断，实际应取免费方案 ID

        await tx.update(userSubscriptionHistory)
          .set({
            autoRenew: !isCanceling,
            status: isCanceling ? 'canceled' : 'active'
          })
          .where(and(eq(userSubscriptionHistory.userId, userId), eq(userSubscriptionHistory.isActive, true)));

        return true;
      });
    } catch (error) {
      console.error('Schedule plan change failed:', error);
      return false;
    }
  }

  /**
   * 仿真处理到期逻辑 (周期末结算)
   */
  async processExpirations(userId: string) {
    const now = new Date();
    const userExt = await this.getUserExtension(userId);
    if (!userExt) return false;

    // 如果没到期，仿真时我们强制它到期，或者逻辑上判断
    // 正常定时任务会判断 expiresAt < now

    const nextId = userExt.nextPlanId;

    if (!nextId) {
      // 场景 A: 自动续费 (nextPlanId 为空)
      // 实际上这里应该触发扣费，扣费成功后执行：
      console.log(`[Lifecycle] Renewing current plan ${userExt.planId} for user ${userId}`);

      const planResult = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, userExt.planId || '')).limit(1);
      const plan = planResult[0];
      if (plan) {
        const nextExpires = new Date(userExt.planExpiresAt || now);
        // 使用 user_extensions.billingInterval 而不是 plan.interval
        if (userExt.billingInterval === 'year') nextExpires.setFullYear(nextExpires.getFullYear() + 1);
        else nextExpires.setMonth(nextExpires.getMonth() + 1);

        await db.update(userExtensions)
          .set({ planExpiresAt: nextExpires, updatedAt: now })
          .where(eq(userExtensions.userId, userId));

        // 发放新一月点数 (Transaction only, no new history)
        const credits = parseFloat(plan.credits || '0');
        await db.insert(userBalances)
          .values({ balance: credits.toString(), updatedAt: now, userId })
          .onConflictDoUpdate({ set: { balance: credits.toString(), updatedAt: now }, target: userBalances.userId });

        await db.insert(userTransactions).values({
          amount: credits,
          balanceAfter: credits.toString(), // 续费后余额重置为套餐点数
          category: 'RENEWAL_GRANT',
          createdAt: now,
          description: `Auto-renewal Success: ${plan.name}`,
          id: 'tx_ren_' + Math.random().toString(36).slice(2, 12),
          type: 'SUBSCRIPTION_GRANT',
          updatedAt: now,
          userId,
        } as any);
      }
    } else {
      // 场景 B: 执行预设变更 (降级或取消到 Free)
      console.log(`[Lifecycle] Executing scheduled switch to ${nextId} for user ${userId}`);

      // 先标记旧的为已过期
      await db.update(userSubscriptionHistory)
        .set({ endedAt: now, isActive: false, status: 'expired' })
        .where(and(eq(userSubscriptionHistory.userId, userId), eq(userSubscriptionHistory.isActive, true)));

      // 降级到 Free 方案时，使用默认的 month 计费周期
      return await this.executeUpgrade(userId, nextId, 'month', 'DOWNGRADE_GRANT');
    }

    return true;
  }

  // 保留旧方法作为兼容层
  async updateUserPlan(userId: string, planData: any) {
    if (planData.planId) {
      // 默认使用 month，如果 planData 中有 billingInterval 则使用它
      const billingInterval = planData.billingInterval || 'month';
      return this.executeUpgrade(userId, planData.planId, billingInterval);
    }
    return false;
  }

  // 管理员用：获取所有用户用量展示
  async getAllUsersUsage(limit: number = 20, offset: number = 0) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString();

    const query = sql`
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.created_at,
        u.last_active_at,
        u.banned,
        ue.current_plan as "planType",
        ue.next_plan_id as "nextPlanId",
        ue.plan_expires_at as "plan_expires_at",
        ue.is_suspended,
        COALESCE(ub.balance, '0') as credit_balance,
        COALESCE(sp.name, CASE
          WHEN ue.current_plan = 'free' OR ue.current_plan = 'plan_free' THEN 'Free'
          WHEN ue.current_plan = 'lite' OR ue.current_plan = 'plan_lite' THEN 'Lite'
          WHEN ue.current_plan = 'pro' OR ue.current_plan = 'plan_pro' THEN 'Pro'
          WHEN ue.current_plan = 'ultra' OR ue.current_plan = 'plan_ultra' THEN 'Ultra'
          ELSE 'Free'
        END) as plan_name,
        COALESCE(msg_count, 0) as monthly_messages,
        COALESCE(session_count, 0) as monthly_sessions,
        COALESCE(file_count, 0) as monthly_files,
        COALESCE(total_size, 0) as monthly_storage_used
      FROM users u
      LEFT JOIN user_extensions ue ON u.id = ue.user_id
      LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
      LEFT JOIN user_balances ub ON u.id = ub.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as msg_count FROM messages WHERE created_at >= ${monthStartStr} GROUP BY user_id
      ) msg_stats ON u.id = msg_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as session_count FROM sessions WHERE created_at >= ${monthStartStr} GROUP BY user_id
      ) session_stats ON u.id = session_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as file_count, COALESCE(SUM(size), 0) as total_size FROM files WHERE created_at >= ${monthStartStr} GROUP BY user_id
      ) file_stats ON u.id = file_stats.user_id
      WHERE u.email != 'admin@system.local'
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await db.execute(query);
    const totalResult = await db.execute(sql`SELECT COUNT(*) as total FROM users WHERE email != 'admin@system.local'`);

    return {
      page: Math.floor(offset / limit) + 1,
      total: parseInt((totalResult[0] as any)?.total || '0'),
      users: result as any[]
    };
  }

  // 获取系统级用量统计
  async getSystemUsageStats(localDate: Date) {
    const startOfPeriod = new Date(localDate.getFullYear(), localDate.getMonth(), 1);
    const endOfPeriod = new Date(localDate.getFullYear(), localDate.getMonth() + 1, 1);
    const startOfPeriodStr = startOfPeriod.toISOString();
    const endOfPeriodStr = endOfPeriod.toISOString();

    // Read from user_transactions (CONSUMPTION type) which stores pre-computed costPrice in metadata.
    // This covers both regular chat completions and system-initiated calls (title generation, etc.).
    const dailyTrend = await db.execute(sql`
      SELECT
        TO_CHAR(t.created_at, 'YYYY-MM-DD') as date,
        t.metadata ->> 'model' as model,
        SUM((COALESCE(t.metadata ->> 'totalInputTokens', '0'))::int) as "totalInputTokens",
        SUM((COALESCE(t.metadata ->> 'totalOutputTokens', '0'))::int) as "totalOutputTokens",
        SUM((COALESCE(t.metadata ->> 'totalInputTokens', '0'))::int + (COALESCE(t.metadata ->> 'totalOutputTokens', '0'))::int) as "totalTokens"
      FROM user_transactions t
      WHERE t.type = 'CONSUMPTION'
      AND t.created_at >= ${startOfPeriodStr}
      AND t.created_at < ${endOfPeriodStr}
      AND t.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
      AND t.metadata ->> 'model' IS NOT NULL
      GROUP BY TO_CHAR(t.created_at, 'YYYY-MM-DD'), t.metadata ->> 'model'
      ORDER BY date ASC
    `);

    const aggregatedStats = await db.execute(sql`
      SELECT
        t.metadata ->> 'model' as model,
        t.metadata ->> 'provider' as provider,
        SUM((COALESCE(t.metadata ->> 'totalInputTokens', '0'))::int) as "totalInputTokens",
        SUM((COALESCE(t.metadata ->> 'totalOutputTokens', '0'))::int) as "totalOutputTokens",
        COUNT(*) as "requestCount",
        SUM((COALESCE(t.metadata ->> 'costPrice', '0'))::numeric) as "totalCostPrice"
      FROM user_transactions t
      WHERE t.type = 'CONSUMPTION'
      AND t.created_at >= ${startOfPeriodStr}
      AND t.created_at < ${endOfPeriodStr}
      AND t.metadata ->> 'model' IS NOT NULL
      GROUP BY t.metadata ->> 'model', t.metadata ->> 'provider'
    `);

    let totalCost = 0;
    const modelStatsMap = new Map<string, any>();

    for (const item of (aggregatedStats as any[])) {
      const cost = parseFloat(item.totalCostPrice || '0');
      totalCost += cost;

      if (!modelStatsMap.has(item.model)) {
        modelStatsMap.set(item.model, { model: item.model, totalTokens: 0, cost: 0 });
      }
      const existing = modelStatsMap.get(item.model);
      existing.totalTokens += (parseInt(item.totalInputTokens) + parseInt(item.totalOutputTokens));
      existing.cost += cost;
    }

    const storageStats = await db.execute(sql`SELECT SUM(size) as "totalSize", COUNT(*) as "fileCount" FROM files`);
    const vectorStats = await db.execute(sql`SELECT COUNT(*) as "vectorCount" FROM embeddings`);

    return {
      dailyTrend: dailyTrend as any[],
      modelStats: Array.from(modelStatsMap.values()).map(m => ({ ...m, cost: m.cost.toFixed(4) })),
      overview: {
        totalCost: totalCost.toFixed(2),
        fileCount: parseInt((storageStats[0] as any)?.fileCount || '0'),
        totalStorageBytes: parseInt((storageStats[0] as any)?.totalSize || '0'),
        vectorCount: parseInt((vectorStats[0] as any)?.vectorCount || '0')
      }
    };
  }
}

export const usageService = new UsageService();