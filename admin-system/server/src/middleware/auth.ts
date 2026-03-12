import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { users } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { JWT_SECRET } from '../config/auth';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
    permissions: string[];
  };
}


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

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // 简化：直接信任Casdoor的JWT，不需要在lobechat表中查找用户
    // 管理员用户通过Casdoor管理，权限通过Casdoor角色控制

    // 设置默认权限（后续可以扩展为从Casdoor角色映射）
    const userData = {
      id: decoded.id,
      username: decoded.username || decoded.name || 'admin',
      email: decoded.email,
      role: decoded.role || 'admin',
      permissions: [
        'users.read',
        'users.write',
        'plans.read',
        'plans.write',
        'stats.read',
        'feedbacks.read',
        'feedbacks.write',
        'system.admin'
      ], // 管理员默认权限
      is_active: true
    };

    // 将用户信息附加到请求对象
    req.user = userData;
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
