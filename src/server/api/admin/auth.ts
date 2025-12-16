import { z } from 'zod';
import { adminProcedure, router, publicProcedure } from '../trpc';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// 模拟管理员数据库（生产环境应该使用真实数据库）
const adminUsers = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@lobechat.com',
    passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMye9HYbAK1GjV7oKe5p5rPMAwG0KJ5XEKe', // password: admin123
    role: 'admin',
    permissions: ['users.read', 'users.write', 'plans.read', 'plans.write', 'api_keys.read', 'api_keys.write'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const authRouter = router({
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input }: { input: { username: string; password: string } }) => {
      const { username, password } = input;

      // 查找管理员用户
      const adminUser = adminUsers.find(user =>
        (user.username === username || user.email === username) && user.isActive
      );

      if (!adminUser) {
        throw new Error('用户名或密码错误');
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash);
      if (!isValidPassword) {
        throw new Error('用户名或密码错误');
      }

      // 生成JWT token
      const token = jwt.sign(
        {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
          permissions: adminUser.permissions,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // 更新最后登录时间
      adminUser.lastLoginAt = new Date();
      adminUser.updatedAt = new Date();

      return {
        success: true,
        data: {
          token,
          user: {
            id: adminUser.id,
            username: adminUser.username,
            email: adminUser.email,
            role: adminUser.role,
          },
        },
      };
    }),

  logout: adminProcedure.mutation(async ({ ctx }: { ctx: any }) => {
    // 实际生产环境中可能需要将token加入黑名单
    return { success: true };
  }),

  currentUser: adminProcedure.query(async ({ ctx }: { ctx: any }) => {
    return {
      success: true,
      data: {
        id: ctx.user.id,
        username: ctx.user.username,
        email: ctx.user.email,
        role: ctx.user.role,
      },
    };
  }),
});