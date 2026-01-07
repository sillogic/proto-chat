import express from 'express';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { usageService } from '../services/usage-service';

const router: express.Router = express.Router();

router.use(authenticateToken);

// GET /api/admin/stats - Get usage and credit stats for a user
router.get('/', requirePermission('stats.read'), async (req: AuthenticatedRequest, res) => {
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

        // 0. Handle System Dashboard Request
        if (userId === 'system_dashboard') {
            const systemStats = await usageService.getSystemUsageStats(monthDate);
            return res.json({
                data: systemStats,
                success: true
            });
        }

        // 1. Get User Extension for billing cycle (if not global)
        let userExt = null;
        if (!isGlobal) {
            userExt = await usageService.getUserExtension(userId);
        }

        // Determine cycle start
        let startOfPeriod;
        if (!isGlobal && userExt) {
            // Fallback to createdAt if planStartedAt is missing
            const startValue = (userExt as any).planStartedAt || userExt.createdAt || new Date();
            const start = new Date(startValue);
            startOfPeriod = new Date(monthDate.getFullYear(), monthDate.getMonth(), start.getDate(), start.getHours(), start.getMinutes());
            if (startOfPeriod > monthDate) {
                startOfPeriod.setMonth(startOfPeriod.getMonth() - 1);
            }
        } else {
            startOfPeriod = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        }

        const startOfPeriodStr = startOfPeriod.toISOString();

        // 2. Run all major stats queries in parallel
        const queries: any[] = [];

        // Query A: Balance
        if (isGlobal) {
            queries.push(db.execute(sql`
              SELECT SUM(balance::numeric) as balance, SUM(total_purchased::numeric) as "totalPurchased"
              FROM user_balances
              WHERE user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
            `));
        } else {
            queries.push(db.execute(sql`
              SELECT balance, total_purchased as "totalPurchased"
              FROM user_balances
              WHERE user_id = ${userId}
            `));
        }

        // Query B: Transactions
        if (isGlobal) {
            queries.push(db.execute(sql`
              SELECT 
                id, 
                amount, 
                balance_after as "balanceAfter", 
                category, 
                description, 
                ref_id as "refId", 
                type, 
                user_id as "userId", 
                created_at as "createdAt"
              FROM user_transactions
              WHERE user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
              ORDER BY created_at DESC
              LIMIT 20
            `));
        } else {
            queries.push(db.execute(sql`
              SELECT 
                id, 
                amount, 
                balance_after as "balanceAfter", 
                category, 
                description, 
                ref_id as "refId", 
                type, 
                user_id as "userId", 
                created_at as "createdAt"
              FROM user_transactions
              WHERE user_id = ${userId}
              ORDER BY created_at DESC
              LIMIT 10
            `));
        }

        // Query C: Usage Service Stats
        queries.push(isGlobal ? Promise.resolve({}) : usageService.getUserMonthlyUsage(userId));

        // Query D: Detailed Usage
        queries.push(db.execute(sql`
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
          ${isGlobal ? sql`AND m.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')` : sql`AND m.user_id = ${userId}`}
          ${isGlobal ? sql`AND m.created_at >= ${startOfPeriodStr}` : sql``}
          ORDER BY m.created_at DESC
          LIMIT 100
        `));

        const [balanceBatch, transactionsResult, usageStats, detailedUsage] = await Promise.all(queries);

        // Process Balance
        let balance: any;
        if (isGlobal) {
            balance = (balanceBatch as any)[0] || { balance: '0.0000', totalPurchased: '0.0000' };
        } else {
            const balanceRes = balanceBatch as any;
            const stats = usageStats as any;

            balance = {
                ...(balanceRes[0] || { balance: '0.0000', totalPurchased: '0.0000' }),
                currentPlan: stats?.credits?.planName || stats?.userExtension?.currentPlan,
                isUnlimited: stats?.credits?.isUnlimited || false,
                limit: stats?.credits?.limit || 0,
                totalConsumed: stats?.credits?.totalConsumed || 0 // 核心变更：使用由交易流水计算出的权威数值
            };
        }
        // Post-process Detailed Usage
        const processedUsage = (detailedUsage as any[]).map((item: any) => {
            const inputPrice = parseFloat(item.inputPrice || '0');
            const outputPrice = parseFloat(item.outputPrice || '0');
            const perRequestPrice = parseFloat(item.perRequestPrice || '0');

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
                transactions: transactionsResult,
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
