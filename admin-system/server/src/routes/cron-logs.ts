import express from 'express';
import { db } from '../config/database';
import { cronJobLogs } from '../db/schema';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { desc, eq, and, gte } from 'drizzle-orm';

const router: express.Router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/admin/cron-logs
 * 获取定时任务执行日志
 */
router.get('/', requirePermission('plans.read'), async (req: AuthenticatedRequest, res) => {
    try {
        const {
            jobName,
            status,
            limit = '50',
            days = '7',
        } = req.query;

        const limitNum = Math.min(parseInt(limit as string, 10) || 50, 200);
        const daysNum = parseInt(days as string, 10) || 7;

        const since = new Date();
        since.setDate(since.getDate() - daysNum);

        const conditions = [gte(cronJobLogs.createdAt, since)];

        if (jobName && typeof jobName === 'string') {
            conditions.push(eq(cronJobLogs.jobName, jobName));
        }

        if (status && typeof status === 'string') {
            conditions.push(eq(cronJobLogs.status, status));
        }

        const logs = await db
            .select()
            .from(cronJobLogs)
            .where(and(...conditions))
            .orderBy(desc(cronJobLogs.createdAt))
            .limit(limitNum);

        return res.json({ data: logs, success: true });
    } catch (error: any) {
        console.error('Error fetching cron logs:', error);
        return res.status(500).json({ message: error.message || '获取定时任务日志失败', success: false });
    }
});

export default router;
