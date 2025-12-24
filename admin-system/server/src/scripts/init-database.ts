import { db } from '../config/database';
import { adminUsers } from '../db/schema';
import bcrypt from 'bcryptjs';

async function initDatabase() {
  try {
    console.log('🗄️ 正在初始化数据库...');

    // 检查是否已经存在管理员用户
    const existingAdmin = await db
      .select()
      .from(adminUsers)
      .where((adminUsers) => adminUsers.username === 'admin')
      .limit(1);

    if (existingAdmin.length === 0) {
      console.log('👤 创建默认管理员用户...');
      const passwordHash = await bcrypt.hash('admin123', 10);

      await db.insert(adminUsers).values({
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
      });

      console.log('✅ 默认管理员用户创建成功!');
      console.log('   用户名: admin');
      console.log('   密码: admin123');
      console.log('   ⚠️  请在生产环境中立即修改默认密码!');
    } else {
      console.log('✅ 管理员用户已存在');
    }

    console.log('🎉 数据库初始化完成!');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase().then(() => {
    process.exit(0);
  });
}

export default initDatabase;