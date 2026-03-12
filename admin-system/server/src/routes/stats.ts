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

        // Query D: Detailed Usage - Query from user_transactions and join with messages
        queries.push(db.execute(sql`
          SELECT
              ut.created_at as "createdAt",
              ut.id,
              ut.amount,
              ut.metadata,
              ut.ref_id as "refId",
              m.model as msg_model,
              m.provider as msg_provider,
              m.metadata as msg_metadata
          FROM user_transactions ut
          LEFT JOIN messages m ON ut.ref_id = m.id
          WHERE ut.type = 'CONSUMPTION'
          ${isGlobal ? sql`AND ut.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')` : sql`AND ut.user_id = ${userId}`}
          ${isGlobal ? sql`AND ut.created_at >= ${startOfPeriodStr}` : sql``}
          ORDER BY ut.created_at DESC
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
            const metadata = (item.metadata as any) || {};
            const msgMetadata = (item.msg_metadata as any) || {};

            // Determine model and provider
            const model = metadata.model || item.msg_model || '-';
            const provider = metadata.provider || item.msg_provider || '-';

            // Determine usage type (chat, embedding, image, etc.)
            let usageType = 'chat';
            if (metadata.type) {
                usageType = metadata.type.toLowerCase();
            } else if (item.msg_model) {
                // If associated with a message, it's chat
                usageType = 'chat';
            } else if (item.refId && item.refId.startsWith('gen_')) {
                // If refId starts with 'gen_', it's image generation
                usageType = 'image';
            }

            // Get token info (for chat/embedding)
            const totalInputTokens = metadata.totalInputTokens || msgMetadata.totalInputTokens || 0;
            const totalOutputTokens = metadata.totalOutputTokens || msgMetadata.totalOutputTokens || 0;
            const totalTokens = totalInputTokens + totalOutputTokens;

            // Get duration (for chat)
            const duration = metadata.duration || msgMetadata.duration || 0;

            // Credits from transaction amount
            const credits = Math.abs(Number(item.amount || 0));

            return {
                id: item.id,
                createdAt: item.createdAt,
                usageType,
                model,
                provider,
                totalInputTokens,
                totalOutputTokens,
                totalTokens,
                duration,
                credits,
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

// GET /api/admin/stats/consumption - 分页+筛选消费明细
router.get('/consumption', requirePermission('stats.read'), async (req: AuthenticatedRequest, res) => {
    try {
        const { userId, dateFrom, dateTo, type, model, limit = '20', offset = '0' } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ message: 'userId is required', success: false });
        }

        const limitNum = Math.min(100, parseInt(limit as string) || 20);
        const offsetNum = parseInt(offset as string) || 0;

        // Build dynamic WHERE conditions
        const conditions = [
            sql`ut.type = 'CONSUMPTION'`,
            sql`ut.user_id = ${userId}`,
        ];
        if (dateFrom) conditions.push(sql`ut.created_at >= ${dateFrom as string}`);
        if (dateTo) conditions.push(sql`ut.created_at <= ${dateTo as string}`);

        const whereClause = sql.join(conditions, sql` AND `);

        // Fetch total count
        const countResult = await db.execute(sql`
            SELECT COUNT(*) as total
            FROM user_transactions ut
            LEFT JOIN messages m ON ut.ref_id = m.id
            WHERE ${whereClause}
        `);
        const total = parseInt((countResult as any)[0]?.total || '0');

        // Fetch page data
        const rows = await db.execute(sql`
            SELECT
                ut.created_at as "createdAt",
                ut.id,
                ut.amount,
                ut.metadata,
                ut.ref_id as "refId",
                m.model as msg_model,
                m.provider as msg_provider,
                m.metadata as msg_metadata
            FROM user_transactions ut
            LEFT JOIN messages m ON ut.ref_id = m.id
            WHERE ${whereClause}
            ORDER BY ut.created_at DESC
            LIMIT ${limitNum} OFFSET ${offsetNum}
        `);

        // Post-process (same logic as existing endpoint)
        let list = (rows as any[]).map((item: any) => {
            const metadata = (item.metadata as any) || {};
            const msgMetadata = (item.msg_metadata as any) || {};
            const itemModel = metadata.model || item.msg_model || '-';
            const provider = metadata.provider || item.msg_provider || '-';
            let usageType = 'chat';
            if (metadata.type) {
                usageType = metadata.type.toLowerCase();
            } else if (item.refId && item.refId.startsWith('gen_')) {
                usageType = 'image';
            } else if (item.msg_model) {
                usageType = 'chat';
            }
            const totalInputTokens = metadata.totalInputTokens || msgMetadata.totalInputTokens || 0;
            const totalOutputTokens = metadata.totalOutputTokens || msgMetadata.totalOutputTokens || 0;
            return {
                id: item.id,
                createdAt: item.createdAt,
                usageType,
                model: itemModel,
                provider,
                totalInputTokens,
                totalOutputTokens,
                totalTokens: totalInputTokens + totalOutputTokens,
                duration: metadata.duration || msgMetadata.duration || 0,
                credits: Math.abs(Number(item.amount || 0)),
            };
        });

        // Apply type/model filter in JS (metadata is JSON, hard to filter in SQL reliably)
        if (type && typeof type === 'string') {
            list = list.filter((item: any) => item.usageType === type);
        }
        if (model && typeof model === 'string') {
            const modelLower = (model as string).toLowerCase();
            list = list.filter((item: any) => item.model?.toLowerCase().includes(modelLower));
        }

        return res.json({ data: { list, total }, success: true });
    } catch (error) {
        console.error('Get consumption error:', error);
        return res.status(500).json({ message: 'Failed to fetch consumption', success: false });
    }
});

// GET /api/admin/stats/transactions - 分页+筛选流水记录
router.get('/transactions', requirePermission('stats.read'), async (req: AuthenticatedRequest, res) => {
    try {
        const { userId, dateFrom, dateTo, limit = '20', offset = '0' } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ message: 'userId is required', success: false });
        }

        const limitNum = Math.min(100, parseInt(limit as string) || 20);
        const offsetNum = parseInt(offset as string) || 0;

        const conditions = [sql`user_id = ${userId}`];
        if (dateFrom) conditions.push(sql`created_at >= ${dateFrom as string}`);
        if (dateTo) conditions.push(sql`created_at <= ${dateTo as string}`);
        const whereClause = sql.join(conditions, sql` AND `);

        const countResult = await db.execute(sql`
            SELECT COUNT(*) as total FROM user_transactions WHERE ${whereClause}
        `);
        const total = parseInt((countResult as any)[0]?.total || '0');

        const rows = await db.execute(sql`
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
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT ${limitNum} OFFSET ${offsetNum}
        `);

        return res.json({ data: { list: rows, total }, success: true });
    } catch (error) {
        console.error('Get transactions error:', error);
        return res.status(500).json({ message: 'Failed to fetch transactions', success: false });
    }
});

export default router;
