import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { adminUsers } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '访问被拒绝，需要提供认证令牌',
      });
    }

    // 验证JWT令牌
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // 从数据库获取用户信息
    const user = await db
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        email: adminUsers.email,
        role: adminUsers.role,
        permissions: adminUsers.permissions,
        isActive: adminUsers.isActive,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, decoded.id))
      .limit(1);

    if (user.length === 0 || !user[0].isActive) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用',
      });
    }

    // 将用户信息附加到请求对象
    req.user = user[0];
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        success: false,
        message: '令牌无效或已过期',
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
};

// 权限检查中间件
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证',
      });
    }

    if (!req.user.permissions.includes(permission) && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足',
      });
    }

    next();
  };
};