import { db } from '../config/database';
import { sql } from 'drizzle-orm';

async function initSimpleUserManagement() {
  try {
    console.log('🚀 初始化简化用户管理系统...');

    // 创建user_extensions表
    console.log('创建 user_extensions 表...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_extensions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        current_plan TEXT NOT NULL DEFAULT 'free',
        plan_expires_at TIMESTAMPTZ,
        monthly_token_limit INTEGER NOT NULL DEFAULT 0,
        monthly_api_calls_limit INTEGER NOT NULL DEFAULT 0,
        monthly_storage_limit INTEGER NOT NULL DEFAULT 1024,
        current_tokens_used INTEGER NOT NULL DEFAULT 0,
        current_api_calls_used INTEGER NOT NULL DEFAULT 0,
        current_storage_used INTEGER NOT NULL DEFAULT 0,
        last_usage_reset TIMESTAMPTZ DEFAULT NOW(),
        features JSONB DEFAULT '{"basicChat":true,"fileUpload":false,"advancedModel":false,"exportHistory":false,"prioritySupport":false,"customAgents":false,"apiAccess":false}',
        is_suspended BOOLEAN NOT NULL DEFAULT false,
        suspend_reason TEXT,
        admin_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS user_extensions_user_id_idx ON user_extensions(user_id);
    `);

    console.log('✅ user_extensions 表创建完成');

    // 为现有用户创建默认扩展记录
    console.log('📋 为现有用户创建扩展记录...');
    const existingUsers = await db.execute(sql`
      SELECT id FROM users
      WHERE id IS NOT NULL
      AND id NOT IN (SELECT user_id FROM user_extensions)
    `);

    if (existingUsers.length > 0) {
      console.log(`发现 ${existingUsers.length} 个现有用户，创建扩展记录...`);

      for (const user of existingUsers) {
        await db.execute(sql`
          INSERT INTO user_extensions (user_id, created_at, updated_at)
          VALUES (${user.id}, NOW(), NOW())
          ON CONFLICT (user_id) DO NOTHING
        `);
      }

      console.log(`✅ 已为 ${existingUsers.length} 个用户创建扩展记录`);
    } else {
      console.log('💡 没有需要初始化的用户');
    }

    // 显示表统计信息
    console.log('\n📊 系统统计：');
    const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const extCount = await db.execute(sql`SELECT COUNT(*) as count FROM user_extensions`);

    console.log(`- 主项目用户数: ${userCount[0].count}`);
    console.log(`- 用户扩展记录数: ${extCount[0].count}`);
    console.log(`- 扩展表覆盖率: ${userCount[0].count > 0 ? Math.round((extCount[0].count / userCount[0].count) * 100) : 0}%`);

    console.log('\n🎉 简化用户管理系统初始化完成！');
    console.log('💡 现在可以直接使用主项目数据，无需额外统计表');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  }
}

// 运行初始化
if (require.main === module) {
  initSimpleUserManagement()
    .then(() => {
      console.log('✨ 初始化成功完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 初始化过程中出现错误:', error);
      process.exit(1);
    });
}

export { initSimpleUserManagement };