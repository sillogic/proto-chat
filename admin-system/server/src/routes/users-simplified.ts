import express from 'express';
import { z } from 'zod';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { usageService } from '../services/usage-service';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// GET /api/users - 获取用户列表和用量统计
router.get('/', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';

    const offset = (page - 1) * limit;

    // 使用简化的用量服务获取用户列表和统计
    const result = await usageService.getAllUsersUsage(limit, offset);

    // 如果有搜索条件，过滤结果
    let filteredUsers = result.users;
    if (search) {
      filteredUsers = result.users.filter(user =>
        user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    return res.json({
      success: true,
      data: {
        users: filteredUsers,
        pagination: {
          page,
          pageSize: limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
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
      currentPlan,
      monthlyTokenLimit = 0,
      monthlyApiCallsLimit = 0,
      monthlyStorageLimit = 1024,
      features = {},
      planExpiresAt
    } = req.body;

    // 验证输入数据
    const updatePlanSchema = z.object({
      currentPlan: z.enum(['free', 'basic', 'pro', 'enterprise']),
      monthlyTokenLimit: z.number().min(0),
      monthlyApiCallsLimit: z.number().min(0),
      monthlyStorageLimit: z.number().min(0),
      features: z.record(z.any()).optional(),
      planExpiresAt: z.string().datetime().optional(),
    });

    const validationResult = updatePlanSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '输入数据无效',
        errors: validationResult.error.errors.map(err => err.message),
      });
    }

    const validatedData = validationResult.data;

    // 更新用户套餐
    const updatedUser = await usageService.updateUserPlan(userId, {
      currentPlan: validatedData.currentPlan,
      monthlyTokenLimit: validatedData.monthlyTokenLimit,
      monthlyApiCallsLimit: validatedData.monthlyApiCallsLimit,
      monthlyStorageLimit: validatedData.monthlyStorageLimit,
      features: validatedData.features || {},
      planExpiresAt: validatedData.planExpiresAt ? new Date(validatedData.planExpiresAt) : undefined
    });

    return res.json({
      success: true,
      message: '用户套餐更新成功',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user plan error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用户套餐失败',
    });
  }
});

// POST /api/users/:userId/reset-usage - 重置用户月度使用量
router.post('/:userId/reset-usage', requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    await usageService.resetMonthlyUsage(userId);

    return res.json({
      success: true,
      message: '用户月度使用量重置成功',
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

export default router;