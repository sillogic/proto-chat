import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/database';
import { adminUsers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { casdoorSyncService } from '../services/casdoor-sync';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// 存储临时状态（生产环境建议使用Redis）
const stateStore = new Map<string, { redirectTo?: string; timestamp: number }>();

// 清理过期的状态
setInterval(() => {
  const now = Date.now();
  for (const [stateId, data] of stateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10分钟过期
      stateStore.delete(stateId);
    }
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 获取Casdoor授权URL
router.get('/login', (req, res) => {
  try {
    const { redirect_to } = req.query;
    const state = crypto.randomBytes(16).toString('hex');

    // 存储状态和重定向URL
    stateStore.set(state, {
      redirectTo: redirect_to as string,
      timestamp: Date.now(),
    });

    // 构建Casdoor授权URL
    const authParams = new URLSearchParams({
      client_id: process.env.AUTH_CASDOOR_ID,
      response_type: 'code',
      redirect_uri: process.env.CASDOOR_REDIRECT_URI,
      scope: 'openid profile email',
      state: state,
    });

    const authUrl = `${process.env.AUTH_CASDOOR_ISSUER}/login/oauth/authorize?${authParams.toString()}`;

    return res.json({
      success: true,
      data: {
        authUrl,
        state,
      },
    });
  } catch (error) {
    console.error('Get Casdoor auth URL error:', error);
    return res.status(500).json({
      success: false,
      message: '获取授权URL失败',
    });
  }
});

// 处理Casdoor回调
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    console.log('🔍 Backend callback received:', {
      code: code ? 'provided' : 'missing',
      state: state ? 'provided' : 'missing'
    });

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: '授权码或状态参数缺失',
      });
    }

    // 验证状态
    const storedState = stateStore.get(state as string);
    if (!storedState) {
      console.log('🔍 State not found in store:', state);
      return res.status(400).json({
        success: false,
        message: '状态无效或已过期',
      });
    }

    // 清理状态
    stateStore.delete(state as string);

    // 从Casdoor获取用户信息
    const userInfo = await casdoorSyncService.getCasdoorUserInfo(code as string);

    console.log('🔍 Casdoor user info received:', {
      id: userInfo.id,
      name: userInfo.name,
      displayName: userInfo.displayName,
      email: userInfo.email,
    });

    // 移除角色检查，所有通过 Casdoor 认证的用户都可以访问后台系统
    // 给予管理员权限以访问后台系统功能
    const userType = 'admin';
    const permissions = [
      // 后台系统权限
      'users.read', 'users.write',
      'plans.read', 'plans.write',
      'api_keys.read', 'api_keys.write',
      'stats.read', 'stats.write',
      'system.admin'
    ];

    console.log('🔍 User granted admin access:', {
      userType,
      permissionsCount: permissions.length
    });

    // 检查是否已存在本地管理员记录
    const existingAdmin = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, userInfo.name))
      .limit(1);

    let adminUser;
    if (existingAdmin.length === 0) {
      // 创建新的管理员记录
      const [newAdmin] = await db.insert(adminUsers).values({
        username: userInfo.name,
        email: userInfo.email,
        passwordHash: '', // Casdoor用户不需要本地密码
        role: userType,
        permissions,
        isActive: true,
        casdoorId: userInfo.id,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      adminUser = newAdmin;
    } else {
      // 更新现有管理员信息
      adminUser = existingAdmin[0];
      await db
        .update(adminUsers)
        .set({
          email: userInfo.email,
          role: userType,
          permissions,
          casdoorId: userInfo.id,
          lastLoginAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(adminUsers.id, adminUser.id));
    }

    // 生成JWT令牌
    const token = jwt.sign(
      {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
        permissions: adminUser.permissions,
        casdoorId: userInfo.id,
        userType,
        authMethod: 'casdoor',
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 获取重定向URL
    const redirectTo = storedState.redirectTo || '/dashboard';

    return res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
          permissions: adminUser.permissions,
          userType,
          authMethod: 'casdoor',
        },
        redirectTo,
      },
    });
  } catch (error) {
    console.error('Casdoor callback error:', error);
    return res.status(500).json({
      success: false,
      message: '登录失败: ' + error.message,
    });
  }
});

// 获取当前用户信息
router.get('/current-user', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '缺少认证令牌',
      });
    }

    // 验证JWT令牌
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.authMethod !== 'casdoor') {
      return res.status(400).json({
        success: false,
        message: '非Casdoor认证用户',
      });
    }

    // 从Casdoor获取最新用户信息
    const casdoorUserInfo = await casdoorSyncService.getCasdoorUserById(decoded.casdoorId);

    return res.json({
      success: true,
      data: {
        user: {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role,
          permissions: decoded.permissions,
          userType: decoded.userType,
          authMethod: decoded.authMethod,
          casdoorInfo: {
            displayName: casdoorUserInfo.displayName,
            avatar: casdoorUserInfo.avatar,
            phone: casdoorUserInfo.phone,
            roles: casdoorUserInfo.roles,
          },
        },
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户信息失败',
    });
  }
});

// 登出
router.post('/logout', (req, res) => {
  return res.json({
    success: true,
    message: '登出成功',
  });
});

export default router;