import { db } from '../config/database';
import { sql } from 'drizzle-orm';

async function createTables() {
  console.log('创建用户扩展表...');

  // 创建用户扩展表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_extensions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT UNIQUE NOT NULL,
      current_plan TEXT DEFAULT 'free',
      plan_expires_at TIMESTAMP,
      monthly_token_limit INTEGER DEFAULT 0,
      monthly_api_calls_limit INTEGER DEFAULT 0,
      current_tokens_used INTEGER DEFAULT 0,
      current_api_calls_used INTEGER DEFAULT 0,
      last_usage_reset TIMESTAMP DEFAULT NOW(),
      features JSONB DEFAULT '{}' NOT NULL,
      is_suspended BOOLEAN DEFAULT false,
      suspend_reason TEXT,
      suspended_at TIMESTAMP,
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_extension_user_id_idx ON user_extensions(user_id);
  `);

  // 创建套餐历史记录表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_subscription_history (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      price INTEGER DEFAULT 0,
      token_limit INTEGER DEFAULT 0,
      api_calls_limit INTEGER DEFAULT 0,
      features JSONB DEFAULT '{}' NOT NULL,
      started_at TIMESTAMP DEFAULT NOW() NOT NULL,
      ended_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true NOT NULL,
      payment_method TEXT,
      transaction_id TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  console.log('✅ 表创建完成');
}

async function createExtensionsForExistingUsers() {
  console.log('为现有用户创建扩展记录...');

  // 获取主项目用户（排除Casdoor用户）
  const mainUsers = (await db.execute(sql`
    SELECT u.id, u.email, u.created_at
    FROM users u
    WHERE u.email NOT LIKE '%@casdoor.com%'
    AND u.id != 'built-in'
    AND NOT EXISTS (
      SELECT 1 FROM user_extensions ue WHERE ue.user_id = u.id
    )
  `)) as unknown as any[];

  if (mainUsers.length === 0) {
    console.log('ℹ️ 所有用户都已创建扩展记录');
    return;
  }

  for (const user of mainUsers) {
    await db.execute(sql`
      INSERT INTO user_extensions (
        user_id, current_plan, features, metadata
      ) VALUES (
        ${user.id}, 'free', ${JSON.stringify({
      advancedModel: false,
      basicChat: true,
      exportHistory: false,
      fileUpload: false,
    })}, ${JSON.stringify({
      source: 'auto_migration',
      userCreatedAt: user.created_at,
      userEmail: user.email
    })}
      )
    `);
  }

  console.log(`✅ 为 ${mainUsers.length} 个用户创建了扩展记录`);
}

async function initializeUserExtensions() {
  try {
    console.log('初始化主项目用户扩展表...');

    // 创建表
    await createTables();

    // 为现有的主项目用户创建扩展记录
    await createExtensionsForExistingUsers();

    console.log('✅ 主项目用户扩展表初始化完成');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  }
}

// 运行脚本
if (require.main === module) {
  initializeUserExtensions()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { initializeUserExtensions };