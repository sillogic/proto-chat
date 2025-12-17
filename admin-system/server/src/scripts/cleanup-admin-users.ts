import { db } from '../config/database';
import { sql } from 'drizzle-orm';

async function cleanupAdminUsersTable() {
  try {
    console.log('开始清理冗余的admin_users表...');

    // 检查表是否存在
    const tableExists = await db.execute(sql.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'admin_users'
      );
    `));

    if (tableExists[0]?.exists) {
      console.log('⚠️ admin_users表存在，正在检查是否可以安全删除...');

      // 检查表中是否有数据
      const countResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as count FROM admin_users
      `));

      const adminCount = countResult[0]?.count || 0;
      console.log(`📊 admin_users表中有 ${adminCount} 条记录`);

      if (adminCount > 0) {
        console.log('ℹ️ 检查这些用户是否已经在users表中存在...');

        // 检查是否有需要迁移的数据
        const migrationCheck = await db.execute(sql.raw(`
          SELECT au.username, au.email, u.id as user_id
          FROM admin_users au
          LEFT JOIN users u ON au.email = u.email
        `));

        const needMigration = migrationCheck.filter(row => !row.user_id);

        if (needMigration.length > 0) {
          console.log(`⚠️ 发现 ${needMigration.length} 个管理员用户需要在users表中创建`);
          console.log('以下用户需要手动处理:');
          needMigration.forEach(user => {
            console.log(`  - ${user.username} (${user.email})`);
          });
          console.log('建议先手动处理这些用户，然后重新运行此脚本');
          return;
        } else {
          console.log('✅ 所有管理员用户都已在users表中存在');
        }
      }

      // 安全删除表
      console.log('🗑️ 正在删除admin_users表...');
      await db.execute(sql.raw('DROP TABLE IF EXISTS admin_users CASCADE;'));

      console.log('✅ admin_users表已删除');
    } else {
      console.log('ℹ️ admin_users表不存在，无需清理');
    }

    // 确认关键表存在
    const tables = ['users', 'user_extensions'];
    for (const tableName of tables) {
      const exists = await db.execute(sql.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '${tableName}'
        );
      `));

      if (exists[0]?.exists) {
        console.log(`✅ ${tableName}表存在`);
      } else {
        console.log(`⚠️ ${tableName}表不存在，请确保已正确初始化`);
      }
    }

    console.log('🎉 清理完成！现在统一使用users表管理所有用户');

  } catch (error) {
    console.error('❌ 清理失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行清理脚本
cleanupAdminUsersTable();