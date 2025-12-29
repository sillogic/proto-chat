import express from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { casdoorSyncService } from '../services/casdoor-sync';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/auth';

const router = express.Router();
const JWT_SECRET_LOCAL = JWT_SECRET;
const JWT_EXPIRES_IN_LOCAL = JWT_EXPIRES_IN;

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
      client_id: process.env.AUTH_CASDOOR_ID || '',
      redirect_uri: process.env.CASDOOR_REDIRECT_URI || '',
      response_type: 'code',
      scope: 'openid profile email',
      state: state,
    });

    const authUrl = `${process.env.AUTH_CASDOOR_ISSUER}/login/oauth/authorize?${authParams.toString()}`;

    return res.json({
      data: {
        authUrl,
        state,
      },
      success: true,
    });
  } catch (error: any) {
    console.error('Get Casdoor auth URL error:', error);
    return res.status(500).json({
      message: '获取授权URL失败',
      success: false,
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
        message: '授权码或状态参数缺失',
        success: false,
      });
    }

    // 验证状态
    const storedState = stateStore.get(state as string);
    if (!storedState) {
      console.log('🔍 State not found in store:', state);
      return res.status(400).json({
        message: '状态无效或已过期',
        success: false,
      });
    }

    // 清理状态
    stateStore.delete(state as string);

    // 从Casdoor获取用户信息
    const userInfo = await casdoorSyncService.getCasdoorUserInfo(code as string);

    console.log('🔍 Casdoor user info received:', {
      displayName: userInfo.displayName,
      email: userInfo.email,
      id: userInfo.id,
      name: userInfo.name,
    });

    const userType = 'user';
    const permissions: string[] = [];

    // 生成JWT令牌
    const token = jwt.sign(
      {
        authMethod: 'casdoor',
        avatar: userInfo.avatar,
        casdoorId: userInfo.id,
        displayName: userInfo.displayName || userInfo.name,
        email: userInfo.email,
        id: userInfo.id,
        permissions,
        role: userType,
        userType,
        username: userInfo.name,
      },
      JWT_SECRET_LOCAL as Secret,
      { expiresIn: JWT_EXPIRES_IN_LOCAL as any }
    );

    // 获取重定向URL
    const redirectTo = storedState.redirectTo || '/dashboard';

    return res.json({
      data: {
        redirectTo,
        token,
        user: {
          displayName: userInfo.displayName || userInfo.name,
          authMethod: 'casdoor',
          email: userInfo.email,
          avatar: userInfo.avatar,
          id: userInfo.id,
          name: userInfo.displayName || userInfo.name,
          permissions,
          role: userType,
          username: userInfo.name,
          userType,
        },
      },
      message: '登录成功',
      success: true,
    });
  } catch (error: any) {
    console.error('Casdoor callback error:', error);
    return res.status(500).json({
      message: '登录失败: ' + (error.message || 'Unknown error'),
      success: false,
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
        message: '缺少认证令牌',
        success: false,
      });
    }

    // 验证JWT令牌
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.authMethod !== 'casdoor') {
      return res.status(400).json({
        message: '非Casdoor认证用户',
        success: false,
      });
    }

    // 从Casdoor获取最新用户信息
    const casdoorUserInfo = await casdoorSyncService.getCasdoorUserById(decoded.casdoorId);

    return res.json({
      data: {
        user: {
          authMethod: decoded.authMethod,
          casdoorInfo: {
            avatar: casdoorUserInfo.avatar,
            displayName: casdoorUserInfo.displayName,
            phone: casdoorUserInfo.phone,
            roles: casdoorUserInfo.roles,
          },
          email: decoded.email,
          id: decoded.id,
          permissions: decoded.permissions,
          role: decoded.role,
          userType: decoded.userType,
          username: decoded.username,
        },
      },
      success: true,
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      message: '获取用户信息失败',
      success: false,
    });
  }
});

// 登出
router.post('/logout', (req, res) => {
  return res.json({
    message: '登出成功',
    success: true,
  });
});

export default router;
