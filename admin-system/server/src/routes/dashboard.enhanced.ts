import express from 'express';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import * as DashboardService from '../services/dashboard-service';

const router: express.Router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// ============================================
// 增强版仪表盘路由
// ============================================

/**
 * GET /api/dashboard/enhanced
 * 获取完整的增强版仪表盘数据
 * Query: period=7d|30d|90d (default: 30d)
 */
router.get(
  '/enhanced',
  requirePermission('stats.read'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const period = (req.query.period as DashboardService.DashboardPeriod) || '30d';

      // 并行查询所有数据
      const [snapshot, periodMetrics, aiUsage, retentionCohorts] = await Promise.all([
        DashboardService.getSnapshotMetrics(),
        DashboardService.getPeriodMetrics(period),
        DashboardService.getAIUsageStats(period),
        DashboardService.getRetentionCohorts(30),
      ]);

      return res.json({
        data: {
          snapshot,
          period: periodMetrics,
          aiUsage,
          retentionCohorts,
        },
        success: true,
      });
    } catch (error: any) {
      console.error('Get enhanced dashboard error:', error);
      return res.status(500).json({
        message: '获取增强版仪表盘数据失败',
        success: false,
      });
    }
  },
);

/**
 * GET /api/dashboard/snapshot
 * 获取存量指标（快照数据，不受 period 影响）
 * 包括：MRR、ARR、总用户数、活跃订阅数等
 */
router.get(
  '/snapshot',
  requirePermission('stats.read'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const snapshot = await DashboardService.getSnapshotMetrics();

      return res.json({
        data: snapshot,
        success: true,
      });
    } catch (error: any) {
      console.error('Get snapshot metrics error:', error);
      return res.status(500).json({
        message: '获取存量指标失败',
        success: false,
      });
    }
  },
);

/**
 * GET /api/dashboard/period-metrics
 * 获取流量指标（受 period 影响）
 * Query: period=7d|30d|90d (default: 30d)
 */
router.get(
  '/period-metrics',
  requirePermission('stats.read'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const period = (req.query.period as DashboardService.DashboardPeriod) || '30d';
      const periodMetrics = await DashboardService.getPeriodMetrics(period);

      return res.json({
        data: periodMetrics,
        success: true,
      });
    } catch (error: any) {
      console.error('Get period metrics error:', error);
      return res.status(500).json({
        message: '获取流量指标失败',
        success: false,
      });
    }
  },
);

/**
 * GET /api/dashboard/ai-usage
 * 获取 AI 使用统计
 * Query: period=7d|30d|90d (default: 30d)
 */
router.get(
  '/ai-usage',
  requirePermission('stats.read'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const period = (req.query.period as DashboardService.DashboardPeriod) || '30d';
      const aiUsage = await DashboardService.getAIUsageStats(period);

      return res.json({
        data: aiUsage,
        success: true,
      });
    } catch (error: any) {
      console.error('Get AI usage stats error:', error);
      return res.status(500).json({
        message: '获取 AI 使用统计失败',
        success: false,
      });
    }
  },
);

/**
 * GET /api/dashboard/retention
 * 获取用户留存率队列数据
 * Query: days=30 (default: 30)
 */
router.get(
  '/retention',
  requirePermission('stats.read'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const retentionCohorts = await DashboardService.getRetentionCohorts(days);

      return res.json({
        data: retentionCohorts,
        success: true,
      });
    } catch (error: any) {
      console.error('Get retention cohorts error:', error);
      return res.status(500).json({
        message: '获取留存率队列失败',
        success: false,
      });
    }
  },
);

export default router;
