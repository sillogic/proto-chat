import express from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { users } from '../db/schema';
import { eq, and, sql, desc, ilike, or } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { casdoorSyncService } from '../services/casdoor-sync';
import { UserPermissions } from '../db/user-permissions';

const router = express.Router();

// 创建用户的验证schema
const createUserSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
  displayName: z.string().min(1, '显示名称不能为空').max(100, '显示名称最多100个字符'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少8个字符').max(128, '密码最多128个字符'),
  phone: z.string().optional(),
  userType: z.enum(['user', 'admin', 'super_admin']).default('user'),
});

// 更新用户的验证schema
const updateUserSchema = z.object({
  displayName: z.string().min(1, '显示名称不能为空').max(100, '显示名称最多100个字符').optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  phone: z.string().optional(),
  banned: z.boolean().optional(),
});

// GET /api/users - 获取用户列表（支持分页和搜索）
router.get('/', authenticateToken, requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { page = 1, limit = 20, search = '', userType = '' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let whereConditions = [];

    // 搜索条件
    if (search) {
      whereConditions.push(
        or(
          ilike(users.username, `%${search}%`),
          ilike(users.displayName, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      );
    }

    // 用户类型过滤（基于邮箱域名或标签）
    if (userType && userType !== 'all') {
      if (userType === 'admin') {
        whereConditions.push(sql`JSON_EXTRACT(${users.settings}, '$.userType') = 'admin'`);
      } else if (userType === 'super_admin') {
        whereConditions.push(sql`JSON_EXTRACT(${users.settings}, '$.userType') = 'super_admin'`);
      } else {
        whereConditions.push(
          or(
            sql`JSON_EXTRACT(${users.settings}, '$.userType') IS NULL`,
            sql`JSON_EXTRACT(${users.settings}, '$.userType') = 'user'`
          )
        );
      }
    }

    // 构建查询条件
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 获取用户列表
    const usersList = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        email: users.email,
        phone: users.phone,
        avatar: users.avatar,
        banned: users.banned,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    // 获取总数
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    return res.json({
      success: true,
      data: {
        users: usersList.map(user => ({
          ...user,
          userType: 'user', // 默认为普通用户，实际类型需要从Casdoor获取
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount[0]?.count || 0,
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
router.get('/:id', authenticateToken, requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const user = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        email: users.email,
        phone: users.phone,
        avatar: users.avatar,
        banned: users.banned,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    return res.json({
      success: true,
      data: {
        user: {
          ...user[0],
          userType: 'user',
        },
      },
    });
  } catch (error) {
    console.error('Get user details error:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户详情失败',
    });
  }
});

// POST /api/users - 创建新用户（同步到Casdoor）
router.post('/', authenticateToken, requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    // 验证输入数据
    const validationResult = createUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '输入数据无效',
        errors: validationResult.error.errors.map(err => err.message),
      });
    }

    const { username, displayName, email, password, phone, userType } = validationResult.data;

    // 检查用户名是否已存在
    const existingUsername = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在',
      });
    }

    // 检查邮箱是否已存在
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: '邮箱已存在',
      });
    }

    // 先在Casdoor中创建用户
    const casdoorResult = await casdoorSyncService.createCasdoorUser({
      name: username,
      displayName,
      email,
      password,
      phone,
      userType,
    });

    if (!casdoorResult.success) {
      return res.status(500).json({
        success: false,
        message: '创建Casdoor用户失败: ' + casdoorResult.error,
      });
    }

    // 在本地数据库中创建用户
    const [newUser] = await db.insert(users).values({
      username,
      displayName,
      email,
      phone: phone || '',
      avatar: '',
      banned: false,
      settings: {
        userType,
        casdoorId: casdoorResult.data.casdoorId,
        createdAt: new Date().toISOString(),
      },
    }).returning({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      phone: users.phone,
      avatar: users.avatar,
      banned: users.banned,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

    return res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: {
        user: {
          ...newUser,
          userType,
          casdoorId: casdoorResult.data.casdoorId,
        },
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: '创建用户失败',
    });
  }
});

// PUT /api/users/:id - 更新用户信息
router.put('/:id', authenticateToken, requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // 验证输入数据
    const validationResult = updateUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '输入数据无效',
        errors: validationResult.error.errors.map(err => err.message),
      });
    }

    const updates = validationResult.data;

    // 检查用户是否存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    // 如果更新邮箱，检查是否已存在
    if (updates.email && updates.email !== existingUser[0].email) {
      const emailExists = await db
        .select()
        .from(users)
        .where(and(
          eq(users.email, updates.email),
          sql`${users.id} != ${id}`
        ))
        .limit(1);

      if (emailExists.length > 0) {
        return res.status(409).json({
          success: false,
          message: '邮箱已被其他用户使用',
        });
      }
    }

    // 获取Casdoor用户ID
    const settings = existingUser[0].settings as any;
    const casdoorId = settings?.casdoorId;

    // 更新本地数据库
    const updateData: any = { ...updates, updatedAt: new Date() };

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        email: users.email,
        phone: users.phone,
        avatar: users.avatar,
        banned: users.banned,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    // 同步更新到Casdoor（如果存在casdoorId）
    if (casdoorId) {
      try {
        await casdoorSyncService.updateCasdoorUser(casdoorId, {
          displayName: updates.displayName,
          email: updates.email,
          phone: updates.phone,
        });
      } catch (casdoorError) {
        console.error('Failed to update Casdoor user:', casdoorError);
        // 不影响本地更新，只记录错误
      }
    }

    return res.json({
      success: true,
      message: '用户信息更新成功',
      data: {
        user: {
          ...updatedUser[0],
          userType: settings?.userType || 'user',
        },
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用户信息失败',
    });
  }
});

// PUT /api/users/:id/status - 更新用户状态（启用/禁用）
router.put('/:id/status', authenticateToken, requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { banned } = req.body;

    if (typeof banned !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '状态值无效',
      });
    }

    // 检查用户是否存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
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
        banned,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return res.json({
      success: true,
      message: `用户已${banned ? '禁用' : '启用'}`,
    });
  } catch (error) {
    console.error('Update user status error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用户状态失败',
    });
  }
});

// DELETE /api/users/:id - 删除用户（同时删除Casdoor中的用户）
router.delete('/:id', authenticateToken, requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    // 获取Casdoor用户ID
    const settings = existingUser[0].settings as any;
    const casdoorId = settings?.casdoorId;

    // 从本地数据库删除用户
    await db.delete(users).where(eq(users.id, id));

    // 从Casdoor删除用户（如果存在casdoorId）
    if (casdoorId) {
      try {
        await casdoorSyncService.deleteCasdoorUser(casdoorId);
      } catch (casdoorError) {
        console.error('Failed to delete Casdoor user:', casdoorError);
        // 不影响本地删除，只记录错误
      }
    }

    return res.json({
      success: true,
      message: '用户删除成功',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      success: false,
      message: '删除用户失败',
    });
  }
});

export default router;