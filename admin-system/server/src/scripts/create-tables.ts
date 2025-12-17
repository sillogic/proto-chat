import { db } from '../config/database';
import { sql } from 'drizzle-orm';

async function createTables() {
  try {
    console.log('🗄️ 正在创建数据库表...');

    // 创建API密钥表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key_type TEXT NOT NULL,
        key_value TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // 创建系统统计表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_stats (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        total_users INTEGER DEFAULT 0 NOT NULL,
        active_users INTEGER DEFAULT 0 NOT NULL,
        new_users INTEGER DEFAULT 0 NOT NULL,
        total_api_calls INTEGER DEFAULT 0 NOT NULL,
        total_tokens_used INTEGER DEFAULT 0 NOT NULL,
        revenue INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // 创建索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_system_stats_date ON system_stats(date)`);

    console.log('✅ 数据库表创建成功!');
  } catch (error) {
    console.error('❌ 创建数据库表失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createTables().then(() => {
    console.log('🎉 数据库初始化完成!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 数据库初始化失败:', error);
    process.exit(1);
  });
}

export default createTables;