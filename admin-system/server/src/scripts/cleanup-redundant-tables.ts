import { db } from '../config/database';
import { sql } from 'drizzle-orm';

async function cleanupRedundantTables() {
  try {
    console.log('🧹 开始清理冗余的数据库表...\n');

    // 删除后台管理系统的冗余表
    const tablesToDrop = [
      'usage_statistics',
      'realtime_usage',
      'user_limit_logs',
      'user_subscription_history'
    ];

    for (const tableName of tablesToDrop) {
      console.log(`🗑️ 删除表: ${tableName}`);
      try {
        await db.execute(sql`DROP TABLE IF EXISTS ${tableName} CASCADE`);
        console.log(`✅ 成功删除: ${tableName}`);
      } catch (error) {
        console.log(`⚠️ 删除失败或表不存在: ${tableName} - ${error.message}`);
      }
    }

    console.log('\n📊 检查剩余的表...');
    const remainingTables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('保留的表:');
    remainingTables.forEach(table => {
      console.log(`✅ ${table.table_name}`);
    });

    console.log('\n🎉 清理完成！');
    console.log('💡 现在只保留核心表: users (主项目) + user_extensions (管理扩展)');

  } catch (error) {
    console.error('❌ 清理过程中出错:', error);
    throw error;
  }
}

// 运行清理
if (require.main === module) {
  cleanupRedundantTables()
    .then(() => {
      console.log('✨ 数据库清理成功完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 清理过程中出现错误:', error);
      process.exit(1);
    });
}

export { cleanupRedundantTables };