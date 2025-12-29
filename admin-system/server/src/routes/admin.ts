import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../config/database';
import { adminUsers } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// 创建管理员用户的验证schema
const createAdminSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少8个字符').max(128, '密码最多128个字符'),
  role: z.enum(['admin', 'super_admin']).default('admin'),
  username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
});

// 重置密码的验证schema
const resetPasswordSchema = z.object({
  password: z.string().min(8, '密码至少8个字符').max(128, '密码最多128个字符'),
});

// POST /api/admin/users - 创建管理员用户
router.post('/users', requirePermission('system.admin'), async (req: AuthenticatedRequest, res) => {
  try {
    // 验证输入数据
    const validationResult = createAdminSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        errors: validationResult.error.errors.map(err => err.message),
        message: '输入数据无效',
        success: false,
      });
    }

    const { username, email, password, role } = validationResult.data;

    // 检查用户名是否已存在
    const existingUsername = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      return res.status(409).json({
        message: '用户名已存在',
        success: false,
      });
    }

    // 检查邮箱是否已存在
    const existingEmail = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return res.status(409).json({
        message: '邮箱已存在',
        success: false,
      });
    }

    // 加密密码
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 定义权限
    const permissions = role === 'super_admin'
      ? ['users.read', 'users.write', 'plans.read', 'plans.write', 'api_keys.read', 'api_keys.write', 'stats.read', 'system.admin']
      : ['users.read', 'stats.read'];

    // 创建管理员用户
    const [newAdmin] = await db.insert(adminUsers).values({
      createdAt: new Date(),
      email,
      isActive: true,
      passwordHash,
      permissions,
      role,
      updatedAt: new Date(),
      username,
    }).returning({
      createdAt: adminUsers.createdAt,
      email: adminUsers.email,
      id: adminUsers.id,
      isActive: adminUsers.isActive,
      permissions: adminUsers.permissions,
      role: adminUsers.role,
      username: adminUsers.username,
    });

    return res.json({
      data: {
        user: newAdmin,
      },
      message: '管理员用户创建成功',
      success: true,
    });
  } catch (error: any) {
    console.error('Create admin error:', error);
    return res.status(500).json({
      message: '创建管理员失败',
      success: false,
    });
  }
});

// POST /api/admin/users/:userId/reset-password - 重置管理员密码
router.post('/users/:userId/reset-password', requirePermission('system.admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    // 验证输入数据
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        errors: validationResult.error.errors.map(err => err.message),
        message: '密码格式无效',
        success: false,
      });
    }

    const { password } = validationResult.data;

    // 检查用户是否存在
    const existingUser = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      return res.status(404).json({
        message: '用户不存在',
        success: false,
      });
    }

    // 加密新密码
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 更新密码
    await db
      .update(adminUsers)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, userId));

    return res.json({
      message: '密码重置成功',
      success: true,
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      message: '重置密码失败',
      success: false,
    });
  }
});

// GET /api/admin/users - 获取管理员用户列表
router.get('/users', requirePermission('system.admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let whereConditions: any[] = [];
    if (search) {
      whereConditions.push(
        sql`(${adminUsers.username} ILIKE ${`%${search}%`} OR ${adminUsers.email} ILIKE ${`%${search}%`})`
      );
    }

    const usersList = await db
      .select({
        createdAt: adminUsers.createdAt,
        email: adminUsers.email,
        id: adminUsers.id,
        isActive: adminUsers.isActive,
        lastLoginAt: adminUsers.lastLoginAt,
        permissions: adminUsers.permissions,
        role: adminUsers.role,
        updatedAt: adminUsers.updatedAt,
        username: adminUsers.username,
      })
      .from(adminUsers)
      .where(and(...whereConditions.map(condition => sql.raw(condition))))
      .orderBy(desc(adminUsers.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    return res.json({
      data: {
        pagination: {
          limit: parseInt(limit as string),
          page: parseInt(page as string),
        },
        users: usersList,
      },
      success: true,
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    return res.status(500).json({
      message: '获取管理员列表失败',
      success: false,
    });
  }
});

// PUT /api/admin/users/:userId/status - 更新管理员状态
router.put('/users/:userId/status', requirePermission('system.admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        message: '状态值无效',
        success: false,
      });
    }

    // 不能禁用自己
    if (String(userId) === String((req as any).user?.id) && !isActive) {
      return res.status(400).json({
        message: '不能禁用自己的账号',
        success: false,
      });
    }

    await db
      .update(adminUsers)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, userId));

    return res.json({
      message: `用户已${isActive ? '启用' : '禁用'}`,
      success: true,
    });
  } catch (error: any) {
    console.error('Update admin status error:', error);
    return res.status(500).json({
      message: '更新用户状态失败',
      success: false,
    });
  }
});

export default router;
