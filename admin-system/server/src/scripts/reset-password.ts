/**
 * 重置管理员密码
 * 用法: tsx src/scripts/reset-password.ts <username> <new-password>
 * 示例: tsx src/scripts/reset-password.ts admin MyNewPassword123
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { adminUsers } from '../db/schema';
import { eq } from 'drizzle-orm';
import process from 'node:process';

dotenv.config({ override: true });

async function resetPassword() {
  const [, , username, newPassword] = process.argv;

  if (!username || !newPassword) {
    console.error('用法: tsx src/scripts/reset-password.ts <username> <new-password>');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('❌ 密码至少需要 8 位');
    process.exit(1);
  }

  const user = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  if (user.length === 0) {
    console.error(`❌ 用户不存在: ${username}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(adminUsers).set({ passwordHash, updatedAt: new Date() }).where(eq(adminUsers.username, username));

  console.log(`✅ 用户 "${username}" 的密码已重置`);
}

resetPassword().catch((err) => {
  console.error('❌ 执行失败:', err.message);
  process.exit(1);
});
