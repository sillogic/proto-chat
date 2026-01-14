import express from 'express';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router: express.Router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/admin/subscriptions/records
 * 获取全量订阅记录
 */
router.get('/records', requirePermission('plans.read'), async (req: AuthenticatedRequest, res) => {
    try {
        const { page = '1', limit = '20', search = '' } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const offset = (pageNum - 1) * limitNum;

        const searchCondition = search
            ? sql`AND (h.user_id ILIKE ${'%' + search + '%'} OR h.plan_name ILIKE ${'%' + search + '%'} OR u.full_name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'})`
            : sql``;

        const records = await db.execute(sql`
            SELECT
                h.id,
                h.user_id as "userId",
                h.plan_name as "planName",
                h.plan_type as "planType",
                h.plan_id as "planId",
                h.slug,
                h.price,
                h.payment_method as "paymentMethod",
                h.is_active as "isActive",
                h.status,
                h.auto_renew as "autoRenew",
                h.started_at as "startedAt",
                h.ended_at as "endedAt",
                h.created_at as "createdAt",
                u.full_name as "fullName",
                u.email
            FROM user_subscription_history h
            LEFT JOIN users u ON h.user_id = u.id
            WHERE h.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
            ${searchCondition}
            ORDER BY h.created_at DESC
            LIMIT ${limitNum}
            OFFSET ${offset}
        `);

        const totalResult = await db.execute(sql`
            SELECT count(*) as count
            FROM user_subscription_history h
            LEFT JOIN users u ON h.user_id = u.id
            WHERE h.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
            ${searchCondition}
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
