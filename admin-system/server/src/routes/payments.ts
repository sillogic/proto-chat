import express from 'express';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router: express.Router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/admin/payments/orders
 * 获取支付订单列表
 */
router.get('/orders', requirePermission('plans.read'), async (req: AuthenticatedRequest, res) => {
    try {
        const { page = '1', limit = '20', search = '', status = '', payChannel = '' } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const offset = (pageNum - 1) * limitNum;

        // 构建搜索条件
        const conditions = [];

        if (search) {
            conditions.push(sql`(
                po.order_no ILIKE ${'%' + search + '%'}
                OR po.user_id ILIKE ${'%' + search + '%'}
                OR u.full_name ILIKE ${'%' + search + '%'}
                OR u.email ILIKE ${'%' + search + '%'}
            )`);
        }

        if (status) {
            conditions.push(sql`po.status = ${status}`);
        }

        if (payChannel) {
            conditions.push(sql`po.pay_channel = ${payChannel}`);
        }

        const whereClause = conditions.length > 0
            ? sql`AND ${sql.join(conditions, sql` AND `)}`
            : sql``;

        // 查询订单列表
        const orders = await db.execute(sql`
            SELECT
                po.id,
                po.order_no as "orderNo",
                po.user_id as "userId",
                po.plan_id as "planId",
                po.plan_interval as "planInterval",
                po.amount,
                po.currency,
                po.subscription_type as "subscriptionType",
                po.duration_months as "durationMonths",
                po.pay_channel as "payChannel",
                po.channel_order_no as "channelOrderNo",
                po.status,
                po.expired_at as "expiredAt",
                po.paid_at as "paidAt",
                po.closed_at as "closedAt",
                po.created_at as "createdAt",
                sp.name as "planName",
                sp.slug as "planSlug",
                u.full_name as "userFullName",
                u.email as "userEmail"
            FROM payment_orders po
            LEFT JOIN subscription_plans sp ON po.plan_id = sp.id
            LEFT JOIN users u ON po.user_id = u.id
            WHERE 1=1
            ${whereClause}
            ORDER BY po.created_at DESC
            LIMIT ${limitNum}
            OFFSET ${offset}
        `);

        // 查询总数
        const totalResult = await db.execute(sql`
            SELECT count(*) as count
            FROM payment_orders po
            LEFT JOIN users u ON po.user_id = u.id
            WHERE 1=1
            ${whereClause}
        `);

        const total = parseInt((totalResult[0] as any).count, 10);

        return res.json({
            data: {
                list: orders,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            },
            success: true
        });
    } catch (error) {
        console.error('Get payment orders error:', error);
        return res.status(500).json({
            message: 'Failed to fetch payment orders',
            success: false,
        });
    }
});

/**
 * GET /api/admin/payments/orders/:id
 * 获取单个订单详情
 */
router.get('/orders/:id', requirePermission('plans.read'), async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;

        const orderResult = await db.execute(sql`
            SELECT
                po.id,
                po.order_no as "orderNo",
                po.user_id as "userId",
                po.plan_id as "planId",
                po.plan_interval as "planInterval",
                po.amount,
                po.currency,
                po.subscription_type as "subscriptionType",
                po.duration_months as "durationMonths",
                po.pay_channel as "payChannel",
                po.channel_order_no as "channelOrderNo",
                po.channel_data as "channelData",
                po.status,
                po.expired_at as "expiredAt",
                po.paid_at as "paidAt",
                po.closed_at as "closedAt",
                po.created_at as "createdAt",
                po.updated_at as "updatedAt",
                sp.name as "planName",
                sp.slug as "planSlug",
                u.full_name as "userFullName",
                u.email as "userEmail"
            FROM payment_orders po
            LEFT JOIN subscription_plans sp ON po.plan_id = sp.id
            LEFT JOIN users u ON po.user_id = u.id
            WHERE po.id = ${id}
        `);

        if (!orderResult || orderResult.length === 0) {
            return res.status(404).json({
                message: 'Order not found',
                success: false,
            });
        }

        return res.json({
            data: orderResult[0],
            success: true
        });
    } catch (error) {
        console.error('Get payment order detail error:', error);
        return res.status(500).json({
            message: 'Failed to fetch payment order detail',
            success: false,
        });
    }
});

export default router;
