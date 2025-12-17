import { db } from '../config/database';
import { sql } from 'drizzle-orm';

async function cleanupUserPlansTable() {
  try {
    console.log('开始清理冗余的user_plans表...');

    // 检查表是否存在
    const tableExists = await db.execute(sql.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_plans'
      );
    `));

    if (tableExists[0]?.exists) {
      console.log('⚠️ user_plans表存在，正在删除...');

      // 删除表和索引
      await db.execute(sql.raw('DROP TABLE IF EXISTS user_plans CASCADE;'));

      console.log('✅ user_plans表已删除');
    } else {
      console.log('ℹ️ user_plans表不存在，无需清理');
    }

    // 确认新的扩展表存在
    const extensionTableExists = await db.execute(sql.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_extensions'
      );
    `));

    if (!extensionTableExists[0]?.exists) {
      console.log('⚠️ user_extensions表不存在，请先运行初始化脚本');
      console.log('运行命令: npx tsx src/scripts/init-user-extensions.ts');
    } else {
      console.log('✅ user_extensions表已存在');
    }

    console.log('🎉 清理完成！现在使用新的user_extensions表替代user_plans表');

  } catch (error) {
    console.error('❌ 清理失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行清理脚本
cleanupUserPlansTable();