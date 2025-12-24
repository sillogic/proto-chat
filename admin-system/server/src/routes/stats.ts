import express from 'express';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { usageService } from '../services/usage-service';

const router = express.Router();

router.use(authenticateToken);

// GET /api/admin/stats - Get usage and credit stats for a user
router.get('/stats', requirePermission('stats.read'), async (req: AuthenticatedRequest, res) => {
    try {
        const { userId, month } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({
                message: 'userId is required',
                success: false,
            });
        }

        const isGlobal = userId === 'all';

        const monthDate = month ? new Date(month as string) : new Date();

        // 默认起始时间（用于全局统计或备份）
        let startOfPeriod = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

        if (!isGlobal) {
            const userExt = await usageService.getUserExtension(userId);
            if (userExt && userExt.planStartedAt) {
                const start = new Date(userExt.planStartedAt);
                // 周年重置逻辑 (Anniversary Reset): 
                // 找出当前计费周期的起始点（即本月或上月的“周年日”）
                startOfPeriod = new Date(monthDate.getFullYear(), monthDate.getMonth(), start.getDate(), start.getHours(), start.getMinutes());
                // 如果计算出的起始点在今天之后，说明本月的周年日还没到，应该取上个月的
                if (startOfPeriod > monthDate) {
                    startOfPeriod.setMonth(startOfPeriod.getMonth() - 1);
                }
            }
        }

        const startOfPeriodStr = startOfPeriod.toISOString();

        // 1. Get Balance
        let balance;
        if (isGlobal) {
            const balanceResult = await db.execute(sql`
              SELECT SUM(balance::numeric) as balance, SUM(total_purchased::numeric) as "totalPurchased"
              FROM user_balances
            `);
            balance = balanceResult[0] || { balance: '0.0000', totalPurchased: '0.0000' };
        } else {
            // 实时从 messages 表聚合本计费周期的积分消耗
            const consumedResult = await db.execute(sql`
              SELECT COALESCE(SUM(calc.credits), 0) as "totalConsumed"
              FROM (
                SELECT
                    ( (COALESCE(m.metadata->>'totalInputTokens', '0'))::int / 1000000.0 * COALESCE(mp.input_price, 0)::numeric ) +
                    ( (COALESCE(m.metadata->>'totalOutputTokens', '0'))::int / 1000000.0 * COALESCE(mp.output_price, 0)::numeric ) +
                    COALESCE(mp.per_request_price, 0)::numeric as credits
                FROM messages m
                LEFT JOIN model_pricings mp ON m.model = mp.model AND m.provider = mp.provider
                WHERE m.user_id = ${userId}
                AND m.role = 'assistant'
                AND m.created_at >= ${startOfPeriodStr}
              ) calc
            `);

            const balanceResult = await db.execute(sql`
              SELECT 
                balance, 
                total_purchased as "totalPurchased"
              FROM user_balances
              WHERE user_id = ${userId}
            `);

            balance = {
                ...(balanceResult[0] || { balance: '0.0000', totalPurchased: '0.0000' }),
                totalConsumed: consumedResult[0]?.totalConsumed || '0'
            };
        }

        // 2. Get Transactions (Recent 10)
        let transactions;
        if (isGlobal) {
            transactions = await db.execute(sql`
              SELECT * FROM user_transactions
              ORDER BY created_at DESC
              LIMIT 20
            `);
        } else {
            transactions = await db.execute(sql`
              SELECT * FROM user_transactions
              WHERE user_id = ${userId}
              ORDER BY created_at DESC
              LIMIT 10
            `);
        }

        // 3. Get Usage Stats
        const usageStats = isGlobal ? {} : await usageService.getUserMonthlyUsage(userId);

        // Fetch detailed usage with Pricing join
        const detailedUsage = await db.execute(sql`
           SELECT
              m.created_at as "createdAt",
              'Chat' as type,
              m.model,
              m.provider,
              (COALESCE(m.metadata->>'totalInputTokens', '0'))::int as "totalInputTokens",
              (COALESCE(m.metadata->>'totalOutputTokens', '0'))::int as "totalOutputTokens",
              (COALESCE(m.metadata->>'totalInputTokens', '0'))::int + (COALESCE(m.metadata->>'totalOutputTokens', '0'))::int as "totalTokens",
              (COALESCE(m.metadata->>'cost', '0'))::numeric as spend,
              (COALESCE(m.metadata->>'tps', '0'))::numeric as tps,
              (COALESCE(m.metadata->>'ttft', '0'))::numeric as ttft,
              m.metadata->>'duration' as duration,
              mp.input_price as "inputPrice",
              mp.output_price as "outputPrice",
              mp.per_request_price as "perRequestPrice"
          FROM messages m
          LEFT JOIN model_pricings mp ON m.model = mp.model AND m.provider = mp.provider
          WHERE m.role = 'assistant'
          ${isGlobal ? sql`` : sql`AND m.user_id = ${userId}`}
          ${isGlobal ? sql`AND m.created_at >= ${startOfPeriodStr}` : sql``}
          ORDER BY m.created_at DESC
          LIMIT 100
        `);

        // Post-process to calculate credits
        const processedUsage = (detailedUsage as any[]).map((item: any) => {
            const inputPrice = parseFloat(item.inputPrice || '0');
            const outputPrice = parseFloat(item.outputPrice || '0');
            const perRequestPrice = parseFloat(item.perRequestPrice || '0');

            // Credits per 1M tokens in DB
            const inputCredits = (item.totalInputTokens / 1_000_000) * inputPrice;
            const outputCredits = (item.totalOutputTokens / 1_000_000) * outputPrice;
            const totalCredits = inputCredits + outputCredits + perRequestPrice;

            return {
                ...item,
                credits: Math.round(totalCredits)
            };
        });

        return res.json({
            data: {
                balance,
                stats: usageStats,
                transactions,
                usage: processedUsage
            },
            success: true
        });

    } catch (error) {
        console.error('Get admin stats error:', error);
        return res.status(500).json({
            message: 'Failed to fetch usage stats',
            success: false,
        });
    }
});

export default router;
