import express from 'express';
import { db } from '../config/database';
import { userTransactions } from '../db/credit-schema';
import { desc, eq, and, sql, or, ilike } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/admin/subscriptions/records
 * 获取全量订阅/赠送记录
 */
router.get('/records', requirePermission('plans.read'), async (req: AuthenticatedRequest, res) => {
    try {
        const { page = '1', limit = '20', search = '' } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const offset = (pageNum - 1) * limitNum;

        const whereConditions = [
            eq(userTransactions.type, 'SUBSCRIPTION_GRANT')
        ];

        if (search) {
            whereConditions.push(
                or(
                    ilike(userTransactions.userId, `%${search}%`),
                    ilike(userTransactions.description, `%${search}%`),
                    ilike(userTransactions.category, `%${search}%`)
                ) as any
            );
        }

        const records = await db
            .select()
            .from(userTransactions)
            .where(and(...whereConditions))
            .orderBy(desc(userTransactions.createdAt))
            .limit(limitNum)
            .offset(offset);

        const totalResult = await db.execute(sql`
          SELECT count(*) as count 
          FROM user_transactions 
          WHERE type = 'SUBSCRIPTION_GRANT'
          ${search ? sql`AND (user_id ILIKE ${'%' + search + '%'} OR description ILIKE ${'%' + search + '%'} OR category ILIKE ${'%' + search + '%'})` : sql``}
        `);

        const total = parseInt((totalResult[0] as any).count, 10);

        return res.json({
            data: {
                list: records,
                pagination: {
                    current: pageNum,
                    pageSize: limitNum,
                    total
                }
            },
            success: true
        });
    } catch (error) {
        console.error('Get subscription records error:', error);
        return res.status(500).json({
            message: 'Failed to fetch subscription records',
            success: false,
        });
    }
});

export default router;
