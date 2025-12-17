import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db, checkAndCreateTables } from '../config/database';
import { adminUsers } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// 登录验证schema
const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

// 创建默认管理员用户
async function ensureDefaultAdmin() {
  try {
    // 首先检查并创建表结构
    console.log('检查数据库表结构...');
    const tablesReady = await checkAndCreateTables();
    if (!tablesReady) {
      console.error('❌ 数据库表结构检查失败');
      return;
    }

    // 检查是否已存在管理员用户
    const existingAdmin = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, 'admin'))
      .limit(1);

    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await db.insert(adminUsers).values({
        username: 'admin',
        email: 'admin@protochat.com',
        passwordHash,
        role: 'super_admin',
        permissions: [
          'users.read',
          'users.write',
          'plans.read',
          'plans.write',
          'api_keys.read',
          'api_keys.write',
          'stats.read',
          'system.admin',
        ],
        isActive: true,
        authMethod: 'local',
      });
      console.log('✅ 默认管理员用户创建成功 (用户名: admin, 密码: admin123)');
    } else {
      console.log('✅ 管理员用户已存在，跳过创建');
    }
  } catch (error) {
    console.error('创建默认管理员失败:', error);
  }
}

// 确保默认管理员存在
ensureDefaultAdmin();

// POST /api/auth/login - 管理员登录
router.post('/login', async (req, res) => {
  try {
    // 验证输入数据
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '输入数据无效',
        errors: validationResult.error.errors.map(err => err.message),
      });
    }

    const { username, password } = validationResult.data;

    // 查找管理员用户
    const adminUser = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    if (adminUser.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    const user = adminUser[0];

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: '账户已被禁用',
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 更新最后登录时间
    await db
      .update(adminUsers)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(adminUsers.id, user.id));

    return res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试',
    });
  }
});

// POST /api/auth/logout - 管理员登出
router.post('/logout', (req, res) => {
  // 在实际应用中，可以在这里将token加入黑名单
  return res.json({
    success: true,
    message: '登出成功',
  });
});

export default router;