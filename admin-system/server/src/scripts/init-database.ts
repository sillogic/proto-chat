import { db } from '../config/database';
import { adminUsers } from '../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function initDatabase() {
  try {
    console.log('🗄️ 正在初始化数据库...');

    // 检查是否已经存在管理员用户
    const existingAdmin = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, 'admin'))
      .limit(1);

    if (existingAdmin.length === 0) {
      console.log('👤 创建默认管理员用户...');
      const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
      const passwordHash = await bcrypt.hash(initialPassword, 10);

      await db.insert(adminUsers).values({
        authMethod: 'local',
        email: 'admin@protochat.com',
        isActive: true,
        passwordHash,
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
        role: 'super_admin',
        username: 'admin',
      });

      console.log('✅ 默认管理员用户创建成功 (用户名: admin, 密码: admin123)');
    } else {
      console.log('ℹ️ 管理员用户已存在，跳过创建');
    }

    console.log('🎉 数据库初始化完成!');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { initDatabase };