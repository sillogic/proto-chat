import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import type { LambdaContext } from '@/libs/trpc/lambda/context';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// 创建 tRPC 实例
const t = initTRPC.context<LambdaContext>().create();

// 管理员用户类型
interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  permissions: string[];
}

// 扩展 Context 类型
interface AdminContext extends LambdaContext {
  user: AdminUser;
}

// 验证管理员权限的中间件
const adminAuth = t.middleware(async ({ ctx, next }) => {
  const token = ctx.authorizationHeader?.replace('Bearer ', '');

  if (!token) {
    throw new Error('未提供认证token');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // 这里应该从数据库验证管理员用户
    // 暂时使用模拟数据
    const adminUser: AdminUser = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };

    if (!adminUser || !adminUser.permissions.length) {
      throw new Error('无效的管理员token');
    }

    return next({
      ctx: {
        ...ctx,
        user: adminUser,
      } as AdminContext,
    });
  } catch (error) {
    throw new Error('无效的认证token');
  }
});

// 创建管理员权限检查中间件
const checkPermission = (permission: string) =>
  t.middleware(async ({ ctx, next }) => {
    const adminCtx = ctx as AdminContext;

    if (!adminCtx.user.permissions.includes(permission) && !adminCtx.user.permissions.includes('*')) {
      throw new Error('权限不足');
    }

    return next();
  });

// 创建管理员权限检查中间件（支持多个权限）
const checkPermissions = (permissions: string[]) =>
  t.middleware(async ({ ctx, next }) => {
    const adminCtx = ctx as AdminContext;

    const hasPermission = permissions.some(permission =>
      adminCtx.user.permissions.includes(permission) || adminCtx.user.permissions.includes('*')
    );

    if (!hasPermission) {
      throw new Error('权限不足');
    }

    return next();
  });

// 创建公开 procedure（不需要认证）
export const publicProcedure = t.procedure;

// 创建管理员 procedure
export const adminProcedure = t.procedure.use(adminAuth);

// 创建带权限检查的 procedure
export const createAdminProcedure = (permission: string | string[]) => {
  const checkMiddleware = Array.isArray(permission)
    ? checkPermissions(permission)
    : checkPermission(permission);

  return t.procedure.use(adminAuth).use(checkMiddleware);
};

// 创建基础 router
export const router = t.router;
export const middleware = t.middleware;

// 定义类型
export type AdminRouter = ReturnType<typeof router>;