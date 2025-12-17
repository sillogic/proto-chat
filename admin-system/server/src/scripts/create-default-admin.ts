import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { adminUsers } from '../db/schema';
import { eq } from 'drizzle-orm';

async function createDefaultAdmin() {
  try {
    console.log('🚀 开始创建默认管理员用户...');

    // 检查是否已存在管理员用户
    const existingAdmin = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, 'admin'))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('✅ 管理员用户已存在');
      console.log(`用户名: ${existingAdmin[0].username}`);
      console.log(`邮箱: ${existingAdmin[0].email}`);
      console.log(`角色: ${existingAdmin[0].role}`);
      return;
    }

    // 创建默认管理员
    const passwordHash = await bcrypt.hash('admin123', 10);

    const newAdmin = await db.insert(adminUsers).values({
      username: 'admin',
      email: 'admin@protochat.com',
      passwordHash,
      role: 'super_admin',
      permissions: [
        'users.read',
        'users.write',
        'plans.read',
        'plans.write',
        'api_keys.read',
        'api_keys.write',
        'stats.read',
        'system.admin',
      ],
      isActive: true,
      authMethod: 'local',
    }).returning();

    console.log('✅ 默认管理员用户创建成功！');
    console.log('用户名: admin');
    console.log('密码: admin123');
    console.log('邮箱: admin@protochat.com');
    console.log('角色: super_admin');
    console.log('\n⚠️ 请在生产环境中修改默认密码！');

  } catch (error) {
    console.error('❌ 创建管理员失败:', error);
    throw error;
  }
}

// 运行脚本
if (require.main === module) {
  createDefaultAdmin()
    .then(() => {
      console.log('✨ 管理员创建完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 创建过程中出现错误:', error);
      process.exit(1);
    });
}

export { createDefaultAdmin };