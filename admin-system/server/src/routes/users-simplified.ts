import express from 'express';
import { z } from 'zod';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { usageService } from '../services/usage-service';
import { db } from '../config/database';
import { users } from '../db/schema';
import { userExtensions } from '../db/user-extensions-schema';
import { eq } from 'drizzle-orm';

const router: express.Router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// GET /api/users - 获取用户列表和用量统计
router.get('/', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    // 前端参数
    const keyword = req.query.keyword as string || '';  // 邮箱搜索
    const planType = req.query.planType as string || '';  // 方案类型筛选

    console.log('查询参数:', { keyword, planType, page, limit });

    const offset = (page - 1) * limit;

    // 使用简化的用量服务获取用户列表和统计
    const result = await usageService.getAllUsersUsage(limit, offset);
    let filteredUsers = result.users;

    // 按邮箱筛选
    if (keyword) {
      filteredUsers = filteredUsers.filter(user =>
        user.email?.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    // 按方案类型筛选
    if (planType) {
      filteredUsers = filteredUsers.filter(user =>
        (user.planType || '').toLowerCase() === planType.toLowerCase()
      );
    }

    return res.json({
      success: true,
      data: {
        users: filteredUsers,
        pagination: {
          page,
          pageSize: limit,
          total: filteredUsers.length,
          totalPages: Math.ceil(filteredUsers.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户列表失败',
    });
  }
});

// GET /api/users/:userId/usage - 获取用户用量统计
router.get('/:userId/usage', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    // 获取用户扩展信息
    const userExtension = await usageService.getUserExtension(userId);
    if (!userExtension) {
      return res.status(404).json({
        success: false,
        message: '用户扩展信息不存在',
      });
    }

    // 获取用户月度用量统计
    const currentUsage = await usageService.getUserMonthlyUsage(userId);

    // 检查用户限制
    const limitCheck = await usageService.checkUserLimits(userId);

    return res.json({
      success: true,
      data: {
        userExtension,
        currentUsage,
        limitCheck
      }
    });
  } catch (error) {
    console.error('Get user usage error:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户用量统计失败',
    });
  }
});

// POST /api/users/:userId/plan - 更新用户套餐
router.post('/:userId/plan', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const {
      planId,
      currentPlan,
      features = {},
      planExpiresAt
    } = req.body;

    // 验证基本结构
    if (!planId && !currentPlan) {
      return res.status(400).json({
        success: false,
        message: 'planId 或 currentPlan 必须提供其一',
      });
    }

    // 更新用户套餐
    const success = await usageService.updateUserPlan(userId, {
      currentPlan,
      features: features || {},
      planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : undefined,
      planId: planId
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新用户套餐失败',
      });
    }

    return res.json({
      success: true,
      message: '用户套餐更新成功',
    });
  } catch (error) {
    console.error('Update user plan error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用户套餐失败',
    });
  }
});

// POST /api/users/:userId/plan/upgrade - 立即升级方案
router.post('/:userId/plan/upgrade', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'planId required' });

    const success = await usageService.executeUpgrade(userId, planId);
    return res.json({ success, message: success ? '升级成功' : '升级失败' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/users/:userId/plan/schedule - 预设次月变更 (降级或取消)
router.post('/:userId/plan/schedule', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { nextPlanId } = req.body;
    const success = await usageService.schedulePlanChange(userId, nextPlanId);
    return res.json({ success, message: success ? '操作成功' : '操作失败' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/users/:userId/plan/simulate-expiry - 仿真过期处理
router.post('/:userId/plan/simulate-expiry', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const success = await usageService.processExpirations(userId);
    return res.json({ success, message: success ? '仿真结算完成' : '仿真结算失败' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/users/:userId/reset-usage - 重置用户月度使用量
router.post('/:userId/reset-usage', requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    // TODO: Implement resetMonthlyUsage in usageService if needed
    // await usageService.resetMonthlyUsage(userId);

    return res.json({
      success: true,
      message: '用户月度使用量重置功能 (待实现)',
    });
  } catch (error) {
    console.error('Reset user usage error:', error);
    return res.status(500).json({
      success: false,
      message: '重置用户使用量失败',
    });
  }
});

// GET /api/users/limits/check - 获取所有用户的限制检查结果
router.get('/limits/check', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    // 这里可以扩展为批量检查多个用户的限制
    // 目前返回一个示例用法
    return res.json({
      success: true,
      message: '用户限制检查功能',
      usage: '请使用单个用户的限制检查: GET /api/users/:userId/usage'
    });
  } catch (error) {
    console.error('Check limits error:', error);
    return res.status(500).json({
      success: false,
      message: '检查用户限制失败',
    });
  }
});

// PUT /api/users/:userId/status - 更新用户状态（封禁/解封）
router.put('/:userId/status', requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { banned, banReason } = req.body;

    // 验证输入
    if (typeof banned !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'banned 参数必须是布尔值',
      });
    }

    // 检查用户是否存在
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    const now = new Date();

    // 更新 users 表的 banned 状态
    await db
      .update(users)
      .set({
        banned,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // 同步更新 user_extensions 表的暂停状态
    await db
      .update(userExtensions)
      .set({
        isSuspended: banned,
        suspendReason: banned ? (banReason || '管理员操作') : null,
        suspendedAt: banned ? now : null,
        updatedAt: now,
      })
      .where(eq(userExtensions.userId, userId));

    return res.json({
      success: true,
      message: banned ? '用户已封禁' : '用户已解封',
      data: {
        banned,
        userId,
      },
    });
  } catch (error) {
    console.error('Update user status error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用户状态失败',
    });
  }
});

export default router;