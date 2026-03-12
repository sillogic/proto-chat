import express from 'express';
import { z } from 'zod';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { usageService } from '../services/usage-service';
import { db } from '../config/database';
import { users } from '../db/schema';
import { userExtensions } from '../db/user-extensions-schema';
import { userBalances, userTransactions } from '../db/credit-schema';
import { eq, sql } from 'drizzle-orm';
import { deleteS3ObjectsByUrls } from '../utils/s3-client';
import crypto from 'node:crypto';

const router: express.Router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// GET /api/users - 获取用户列表和用量统计
router.get('/', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const keyword = req.query.keyword as string || '';
    const planType = req.query.planType as string || '';
    // all | active | paid | free | purged
    const accountStatus = req.query.accountStatus as string || 'all';

    const offset = (page - 1) * limit;

    const result = await usageService.getAllUsersUsage(limit, offset);
    let filteredUsers = result.users;

    // 按邮箱搜索
    if (keyword) {
      filteredUsers = filteredUsers.filter(user =>
        user.email?.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    // 按方案类型筛选
    if (planType) {
      filteredUsers = filteredUsers.filter(user =>
        (user.planType || '').toLowerCase() === planType.toLowerCase()
      );
    }

    // 按账号状态 Tab 筛选
    const isPurged = (u: any) => u.email?.endsWith('@deleted.invalid');
    if (accountStatus === 'active') {
      filteredUsers = filteredUsers.filter(u => !isPurged(u));
    } else if (accountStatus === 'paid') {
      filteredUsers = filteredUsers.filter(u => !isPurged(u) && (u.planType || 'free') !== 'free');
    } else if (accountStatus === 'free') {
      filteredUsers = filteredUsers.filter(u => !isPurged(u) && (u.planType || 'free') === 'free');
    } else if (accountStatus === 'purged') {
      filteredUsers = filteredUsers.filter(u => isPurged(u));
    }

    return res.json({
      success: true,
      data: {
        users: filteredUsers,
        pagination: {
          page,
          pageSize: limit,
          total: filteredUsers.length,
          totalPages: Math.ceil(filteredUsers.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户列表失败',
    });
  }
});

// GET /api/users/:userId/usage - 获取用户用量统计
router.get('/:userId/usage', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    // 获取用户扩展信息
    const userExtension = await usageService.getUserExtension(userId);
    if (!userExtension) {
      return res.status(404).json({
        success: false,
        message: '用户扩展信息不存在',
      });
    }

    // 获取用户月度用量统计
    const currentUsage = await usageService.getUserMonthlyUsage(userId);

    // 检查用户限制
    const limitCheck = await usageService.checkUserLimits(userId);

    return res.json({
      success: true,
      data: {
        userExtension,
        currentUsage,
        limitCheck
      }
    });
  } catch (error) {
    console.error('Get user usage error:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户用量统计失败',
    });
  }
});

// POST /api/users/:userId/plan - 更新用户套餐
router.post('/:userId/plan', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const {
      planId,
      currentPlan,
      features = {},
      planExpiresAt
    } = req.body;

    // 验证基本结构
    if (!planId && !currentPlan) {
      return res.status(400).json({
        success: false,
        message: 'planId 或 currentPlan 必须提供其一',
      });
    }

    // 更新用户套餐
    const success = await usageService.updateUserPlan(userId, {
      currentPlan,
      features: features || {},
      planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : undefined,
      planId: planId
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新用户套餐失败',
      });
    }

    return res.json({
      success: true,
      message: '用户套餐更新成功',
    });
  } catch (error) {
    console.error('Update user plan error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用户套餐失败',
    });
  }
});

// POST /api/users/:userId/plan/upgrade - 立即升级方案
router.post('/:userId/plan/upgrade', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { planId, billingInterval = 'month' } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'planId required' });

    const success = await usageService.executeUpgrade(userId, planId, billingInterval);
    return res.json({ success, message: success ? '升级成功' : '升级失败' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/users/:userId/plan/schedule - 预设次月变更 (降级或取消)
router.post('/:userId/plan/schedule', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { nextPlanId } = req.body;
    const success = await usageService.schedulePlanChange(userId, nextPlanId);
    return res.json({ success, message: success ? '操作成功' : '操作失败' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/users/:userId/plan/simulate-expiry - 仿真过期处理
router.post('/:userId/plan/simulate-expiry', requirePermission('plans.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const success = await usageService.processExpirations(userId);
    return res.json({ success, message: success ? '仿真结算完成' : '仿真结算失败' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/users/:userId/reset-usage - 重置用户月度使用量
router.post('/:userId/reset-usage', requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    // TODO: Implement resetMonthlyUsage in usageService if needed
    // await usageService.resetMonthlyUsage(userId);

    return res.json({
      success: true,
      message: '用户月度使用量重置功能 (待实现)',
    });
  } catch (error) {
    console.error('Reset user usage error:', error);
    return res.status(500).json({
      success: false,
      message: '重置用户使用量失败',
    });
  }
});

// GET /api/users/limits/check - 获取所有用户的限制检查结果
router.get('/limits/check', requirePermission('users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    // 这里可以扩展为批量检查多个用户的限制
    // 目前返回一个示例用法
    return res.json({
      success: true,
      message: '用户限制检查功能',
      usage: '请使用单个用户的限制检查: GET /api/users/:userId/usage'
    });
  } catch (error) {
    console.error('Check limits error:', error);
    return res.status(500).json({
      success: false,
      message: '检查用户限制失败',
    });
  }
});

// PUT /api/users/:userId/status - 更新用户状态（封禁/解封）
router.put('/:userId/status', requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { banned, banReason } = req.body;

    // 验证输入
    if (typeof banned !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'banned 参数必须是布尔值',
      });
    }

    // 检查用户是否存在
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    const now = new Date();

    // 更新 users 表的 banned 状态
    await db
      .update(users)
      .set({
        banned,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // 同步更新 user_extensions 表的暂停状态
    await db
      .update(userExtensions)
      .set({
        isSuspended: banned,
        suspendReason: banned ? (banReason || '管理员操作') : null,
        suspendedAt: banned ? now : null,
        updatedAt: now,
      })
      .where(eq(userExtensions.userId, userId));

    return res.json({
      success: true,
      message: banned ? '用户已封禁' : '用户已解封',
      data: {
        banned,
        userId,
      },
    });
  } catch (error) {
    console.error('Update user status error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用户状态失败',
    });
  }
});

// PUT /api/users/:userId/admin-force - 管理员强制编辑（测试用，绕过业务流程，不写支付/订阅历史）
router.put('/:userId/admin-force', requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  const { action, planType, planExpiresAt, creditDelta } = req.body;

  // 确认用户存在
  const ext = await db.select().from(userExtensions).where(eq(userExtensions.userId, userId)).limit(1);

  try {
    if (action === 'forcePlan') {
      // 直接写 user_extensions，不走 executeUpgrade，不产生支付/订阅历史
      const isFree = !planType || planType === 'free';
      await db.update(userExtensions).set({
        currentPlan: isFree ? 'free' : planType,
        planId: isFree ? null : undefined,          // free 时清空 planId
        planExpiresAt: isFree ? null : (planExpiresAt ? new Date(planExpiresAt) : null),
        billingInterval: isFree ? null : undefined,
        updatedAt: new Date(),
      }).where(eq(userExtensions.userId, userId));

      return res.json({ success: true, message: `方案已强制切换为 ${planType || 'free'}` });
    }

    if (action === 'adjustCredits') {
      const delta = parseFloat(String(creditDelta));
      if (isNaN(delta) || delta === 0) {
        return res.status(400).json({ success: false, message: 'creditDelta 不能为 0' });
      }

      // 读当前余额
      const balRow = await db.select().from(userBalances).where(eq(userBalances.userId, userId)).limit(1);
      const currentBalance = parseFloat(String(balRow[0]?.balance ?? '0'));
      const newBalance = Math.max(0, currentBalance + delta); // 不允许余额为负

      // 更新余额
      if (balRow.length > 0) {
        await db.update(userBalances).set({
          balance: String(newBalance),
          updatedAt: new Date(),
        }).where(eq(userBalances.userId, userId));
      } else {
        await db.insert(userBalances).values({
          userId,
          balance: String(newBalance),
          totalPurchased: delta > 0 ? String(delta) : '0',
        });
      }

      // 写一条有标识的 ADJUSTMENT 记录，方便与真实交易区分
      await db.insert(userTransactions).values({
        id: crypto.randomUUID(),
        userId,
        type: 'ADJUSTMENT',
        amount: String(delta),
        balanceAfter: String(newBalance),
        description: `[管理员测试调整] ${delta > 0 ? '+' : ''}${delta}`,
        category: 'admin_test',
      });

      return res.json({ success: true, message: `积分已调整 ${delta > 0 ? '+' : ''}${delta}，当前余额 ${newBalance}` });
    }

    if (action === 'resetUsage') {
      await db.update(userExtensions).set({ lastUsageReset: new Date(), updatedAt: new Date() })
        .where(eq(userExtensions.userId, userId));
      return res.json({ success: true, message: '月度用量已重置' });
    }

    return res.status(400).json({ success: false, message: '未知 action' });
  } catch (error: any) {
    console.error('Admin force edit error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/users/:userId - 注销用户账号（软删除：匿名化用户信息，清理数据，保留成本记录）
router.delete('/:userId', requirePermission('users.write'), async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;

  // 查找用户
  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userResult.length === 0) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  const user = userResult[0];
  const oldEmail = user.email;

  try {
    // 统计将被清理的数据量（仅用于返回信息）
    const [msgCount, fileCount] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) AS c FROM messages WHERE user_id = ${userId}`),
      db.execute(sql`SELECT COUNT(*) AS c FROM files WHERE user_id = ${userId}`),
    ]);

    // 1. 删除 betterAuth 登录凭据（阻断登录）
    await db.execute(sql`DELETE FROM accounts WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM auth_sessions WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM two_factor WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM passkey WHERE "userId" = ${userId}`);

    // 2. 删除聊天数据（sessions cascade 到 topics/messages）
    await db.execute(sql`DELETE FROM sessions WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM topics WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM messages WHERE user_id = ${userId}`);

    // 3. 清理 OSS 对象：找出只被该用户引用的 global_files（无其他用户共享）
    const exclusiveGlobalFiles = await db.execute(sql`
      SELECT gf.hash_id, gf.url
      FROM global_files gf
      INNER JOIN files f ON f.file_hash = gf.hash_id AND f.user_id = ${userId}
      WHERE NOT EXISTS (
        SELECT 1 FROM files f2
        WHERE f2.file_hash = gf.hash_id AND f2.user_id != ${userId}
      )
    `);
    const exclusiveUrls = (exclusiveGlobalFiles as any[]).map((r: any) => r.url).filter(Boolean);
    const exclusiveHashIds = (exclusiveGlobalFiles as any[]).map((r: any) => r.hash_id).filter(Boolean);

    // 先删 OSS 对象，再删 DB 记录
    let deletedOssCount = 0;
    if (exclusiveUrls.length > 0) {
      deletedOssCount = await deleteS3ObjectsByUrls(exclusiveUrls);
      if (exclusiveHashIds.length > 0) {
        await db.execute(sql`
          DELETE FROM global_files WHERE hash_id = ANY(${exclusiveHashIds})
        `);
      }
    }

    // 4. 删除用户文件/知识库/向量数据（chunks/embeddings 级联）
    await db.execute(sql`DELETE FROM files WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM documents WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM knowledge_bases WHERE user_id = ${userId}`);

    // 5. 删除用户扩展信息
    await db.delete(userExtensions).where(eq(userExtensions.userId, userId));

    // 6. 清理邮箱验证记录（释放 identifier 槽位）
    if (oldEmail) {
      await db.execute(sql`DELETE FROM verifications WHERE identifier = ${oldEmail}`);
    }

    // 7. 匿名化用户行（保留 userId 以维持 user_balances/user_transactions 外键引用）
    const anonymousEmail = `deleted_${userId}@deleted.invalid`;
    await db.update(users).set({
      email: anonymousEmail,
      normalizedEmail: anonymousEmail,
      username: `deleted_${userId}`,
      fullName: null,
      firstName: null,
      lastName: null,
      phone: null,
      avatar: null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    return res.json({
      success: true,
      message: '用户账号已注销',
      data: {
        deletedMessages: Number((msgCount as any)[0]?.c ?? 0),
        deletedFiles: Number((fileCount as any)[0]?.c ?? 0),
        deletedOssObjects: deletedOssCount,
      },
    });
  } catch (error: any) {
    console.error('Purge user error:', error);
    return res.status(500).json({ success: false, message: '注销用户失败: ' + error.message });
  }
});

export default router;