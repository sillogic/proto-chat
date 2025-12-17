import express from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { users, userPlans } from '../db/schema';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// GET /api/users - 获取用户列表
router.get('/', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const isActive = req.query.isActive;

    const offset = (page - 1) * limit;

    // 构建查询条件
    let whereConditions = [];

    if (search) {
      whereConditions.push(
        `(${users.username} ILIKE '%${search}%' OR ${users.email} ILIKE '%${search}%')`
      );
    }

    if (isActive !== undefined) {
      whereConditions.push(`${users.isActive} = ${isActive === 'true'}`);
    }

    // 获取用户列表
    const usersList = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(...whereConditions.map(condition => sql.raw(condition))))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // 获取总数
    const totalCount = await db
      .select({ count: count() })
      .from(users)
      .where(and(...whereConditions.map(condition => sql.raw(condition))));

    return res.json({
      success: true,
      data: {
        users: usersList,
        pagination: {
          page,
          limit,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户列表失败',
    });
  }
});

// GET /api/users/:id - 获取用户详情
router.get('/:id', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params.id;

    const user = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    // 获取用户套餐信息
    const userPlan = await db
      .select()
      .from(userPlans)
      .where(and(
        eq(userPlans.userId, userId),
        eq(userPlans.isActive, true)
      ))
      .limit(1);

    return res.json({
      success: true,
      data: {
        user: user[0],
        plan: userPlan[0] || null,
      },
    });
  } catch (error) {
    console.error('Get user detail error:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户详情失败',
    });
  }
});

// PUT /api/users/:id/status - 更新用户状态
router.put('/:id/status', requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params.id;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '状态值无效',
      });
    }

    // 检查用户是否存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    // 更新用户状态
    await db
      .update(users)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return res.json({
      success: true,
      message: `用户已${isActive ? '启用' : '禁用'}`,
    });
  } catch (error) {
    console.error('Update user status error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用户状态失败',
    });
  }
});

// POST /api/users/update-plan - 更新用户套餐
router.post('/update-plan', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, planType, planName, features, expiresAt } = req.body;

    // 验证输入数据
    const updatePlanSchema = z.object({
      userId: z.string().uuid('用户ID格式无效'),
      planType: z.enum(['free', 'basic', 'pro', 'enterprise']),
      planName: z.string().min(1, '套餐名称不能为空'),
      features: z.record(z.any()).optional().default({}),
      expiresAt: z.string().datetime().optional(),
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

    // 检查用户是否存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, validatedData.userId))
      .limit(1);

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    // 先停用用户现有的套餐
    await db
      .update(userPlans)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userPlans.userId, validatedData.userId),
        eq(userPlans.isActive, true)
      ));

    // 创建新的套餐记录
    await db.insert(userPlans).values({
      userId: validatedData.userId,
      planType: validatedData.planType,
      planName: validatedData.planName,
      features: validatedData.features,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
      isActive: true,
    });

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

export default router;