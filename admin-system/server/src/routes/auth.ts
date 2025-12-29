import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret } from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../config/database';
import { adminUsers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/auth';

const router = express.Router();

const JWT_SECRET_LOCAL = JWT_SECRET;
const JWT_EXPIRES_IN_LOCAL = JWT_EXPIRES_IN;

// 登录验证schema
const loginSchema = z.object({
  password: z.string().min(1, '密码不能为空'),
  username: z.string().min(1, '用户名不能为空'),
});

// POST /api/auth/login - 管理员登录
router.post('/login', async (req, res) => {
  try {
    // 验证输入数据
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        errors: validationResult.error.errors.map(err => err.message),
        message: '输入数据无效',
        success: false,
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
        message: '用户名或密码错误',
        success: false,
      });
    }

    const user = adminUser[0];

    if (!user.isActive) {
      return res.status(401).json({
        message: '账户已被禁用',
        success: false,
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        message: '用户名或密码错误',
        success: false,
      });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      {
        email: user.email,
        id: user.id,
        permissions: user.permissions,
        role: user.role,
        username: user.username,
      },
      JWT_SECRET_LOCAL as Secret,
      { expiresIn: JWT_EXPIRES_IN_LOCAL as any }
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
      data: {
        token,
        user: {
          email: user.email,
          id: user.id,
          permissions: user.permissions,
          role: user.role,
          username: user.username,
        },
      },
      message: '登录成功',
      success: true,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      message: '登录失败，请稍后重试',
      success: false,
    });
  }
});

// POST /api/auth/logout - 管理员登出
router.post('/logout', (req, res) => {
  // 在实际应用中，可以在这里将token加入黑名单
  return res.json({
    message: '登出成功',
    success: true,
  });
});

export default router;
