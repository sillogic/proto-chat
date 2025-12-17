import { db } from '../config/database';
import { userExtensions } from '../db/user-extensions-schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { UserExtension } from '../db/user-extensions-schema';

export class UsageService {
  // 获取用户月度使用统计（基于现有业务表）
  async getUserMonthlyUsage(userId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString();

    // 查询消息统计
    const messageStats = await db.execute(sql`
      SELECT
        COUNT(*) as message_count,
        COUNT(CASE WHEN role != 'user' THEN 1 END) as assistant_messages
      FROM messages
      WHERE user_id = ${userId}
      AND created_at >= ${monthStartStr}
    `);

    // 查询会话统计
    const sessionStats = await db.execute(sql`
      SELECT COUNT(*) as session_count
      FROM sessions
      WHERE user_id = ${userId}
      AND created_at >= ${monthStartStr}
    `);

    // 查询文件统计
    const fileStats = await db.execute(sql`
      SELECT
        COUNT(*) as file_count,
        COALESCE(SUM(size), 0) as total_size
      FROM files
      WHERE user_id = ${userId}
      AND created_at >= ${monthStartStr}
    `);

    return {
      messages: {
        count: parseInt(messageStats[0]?.message_count || '0'),
        assistantMessages: parseInt(messageStats[0]?.assistant_messages || '0')
      },
      sessions: {
        count: parseInt(sessionStats[0]?.session_count || '0')
      },
      files: {
        count: parseInt(fileStats[0]?.file_count || '0'),
        totalSize: parseInt(fileStats[0]?.total_size || '0'),
        totalSizeMB: Math.round(parseInt(fileStats[0]?.total_size || '0') / 1024 / 1024)
      }
    };
  }

  // 检查用户限制
  async checkUserLimits(userId: string) {
    const userExtension = await this.getUserExtension(userId);
    if (!userExtension) {
      return { allowed: true, message: 'User not found' };
    }

    const currentUsage = await this.getUserMonthlyUsage(userId);
    const limits = [];

    // 检查存储限制
    if (userExtension.monthlyStorageLimit > 0) {
      const usagePercent = (currentUsage.files.totalSizeMB / userExtension.monthlyStorageLimit) * 100;
      if (usagePercent >= 100) {
        limits.push({
          type: 'storage_limit',
          current: currentUsage.files.totalSizeMB,
          limit: userExtension.monthlyStorageLimit,
          percentage: Math.round(usagePercent),
          exceeded: true
        });
      } else if (usagePercent >= 90) {
        limits.push({
          type: 'storage_limit',
          current: currentUsage.files.totalSizeMB,
          limit: userExtension.monthlyStorageLimit,
          percentage: Math.round(usagePercent),
          warning: true
        });
      }
    }

    return {
      allowed: !limits.some(l => l.exceeded),
      userExtension,
      currentUsage,
      limits: limits.filter(l => l.exceeded || l.warning)
    };
  }

  // 获取用户扩展信息
  async getUserExtension(userId: string): Promise<UserExtension | null> {
    const result = await db
      .select()
      .from(userExtensions)
      .where(eq(userExtensions.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  // 创建或更新用户扩展信息
  async upsertUserExtension(userId: string, data: Partial<UserExtension>) {
    const existing = await this.getUserExtension(userId);

    if (existing) {
      // 更新
      await db
        .update(userExtensions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userExtensions.userId, userId));
    } else {
      // 创建
      await db.insert(userExtensions).values({
        userId,
        ...data
      });
    }

    return this.getUserExtension(userId);
  }

  // 重置月度使用量（在月初调用）
  async resetMonthlyUsage(userId: string) {
    const currentUsage = await this.getUserMonthlyUsage(userId);

    await db
      .update(userExtensions)
      .set({
        currentTokensUsed: currentUsage.messages.assistantMessages, // 更新为实际使用量
        currentApiCallsUsed: currentUsage.sessions.count,
        currentStorageUsed: currentUsage.files.totalSizeMB,
        lastUsageReset: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userExtensions.userId, userId));

    return true;
  }

  // 更新用户套餐
  async updateUserPlan(userId: string, planData: {
    currentPlan: string;
    monthlyTokenLimit: number;
    monthlyApiCallsLimit: number;
    monthlyStorageLimit: number;
    features: any;
    planExpiresAt?: Date;
  }) {
    return this.upsertUserExtension(userId, planData);
  }

  // 获取所有用户的用量统计（管理员用）
  async getAllUsersUsage(limit: number = 20, offset: number = 0) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString();

    // 查询用户及其用量统计
    const query = sql`
      SELECT
        u.id,
        u.username,
        u.email,
        u.created_at as user_created_at,
        ue.current_plan,
        ue.monthly_token_limit,
        ue.monthly_api_calls_limit,
        ue.monthly_storage_limit,
        ue.is_suspended,
        COALESCE(msg_count, 0) as monthly_messages,
        COALESCE(session_count, 0) as monthly_sessions,
        COALESCE(file_count, 0) as monthly_files,
        COALESCE(total_size, 0) as monthly_storage_used
      FROM users u
      LEFT JOIN user_extensions ue ON u.id = ue.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as msg_count
        FROM messages
        WHERE created_at >= ${monthStartStr}
        GROUP BY user_id
      ) msg_stats ON u.id = msg_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as session_count
        FROM sessions
        WHERE created_at >= ${monthStartStr}
        GROUP BY user_id
      ) session_stats ON u.id = session_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as file_count, COALESCE(SUM(size), 0) as total_size
        FROM files
        WHERE created_at >= ${monthStartStr}
        GROUP BY user_id
      ) file_stats ON u.id = file_stats.user_id
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await db.execute(query);

    // 计算总量
    const totalQuery = sql`SELECT COUNT(*) as total FROM users`;
    const totalResult = await db.execute(totalQuery);

    return {
      users: result,
      total: parseInt(totalResult[0]?.total || '0'),
      page: Math.floor(offset / limit) + 1,
      pageSize: limit
    };
  }
}

export const usageService = new UsageService();