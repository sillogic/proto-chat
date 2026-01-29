/**
 * 清理未验证用户脚本
 *
 * 删除满足以下条件的用户：
 * 1. 未验证邮箱 (emailVerified = false)
 * 2. 创建时间超过 X 天 (默认 7 天)
 * 3. 没有 user_extensions 记录 (未初始化)
 *
 * 执行方式: npx tsx scripts/cleanup-unverified-users.ts [天数]
 * 示例: npx tsx scripts/cleanup-unverified-users.ts 7
 */

import { and, eq, isNull, lt, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { users } from '../packages/database/src/schemas/user';
import { userExtensions } from '../packages/database/src/schemas/userExtension';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL 环境变量未设置');
  process.exit(1);
}

// 从命令行参数获取保留天数，默认 7 天
const retentionDays = parseInt(process.argv[2] || '7', 10);

console.log('🔗 连接数据库...');
const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function main() {
  console.log('');
  console.log(`📋 清理未验证用户（保留 ${retentionDays} 天内的）`);
  console.log('');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  console.log(`⏰ 截止日期: ${cutoffDate.toISOString()}`);
  console.log('');

  // 查找未验证且未初始化的用户
  const unverifiedUsers = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(userExtensions, eq(users.id, userExtensions.userId))
    .where(
      and(
        eq(users.emailVerified, false),
        lt(users.createdAt, cutoffDate),
        isNull(userExtensions.userId)
      )
    );

  if (unverifiedUsers.length === 0) {
    console.log('✅ 没有需要清理的未验证用户');
    await pool.end();
    return;
  }

  console.log(`🔍 找到 ${unverifiedUsers.length} 个未验证用户:`);
  console.log('');
  unverifiedUsers.forEach((u) => {
    console.log(`  - ${u.email} (创建于 ${u.createdAt?.toISOString()})`);
  });
  console.log('');

  // 删除用户
  const userIds = unverifiedUsers.map((u) => u.id);
  await db.delete(users).where(inArray(users.id, userIds));

  console.log(`✅ 已删除 ${unverifiedUsers.length} 个未验证用户`);
  console.log('');

  await pool.end();
}

main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
