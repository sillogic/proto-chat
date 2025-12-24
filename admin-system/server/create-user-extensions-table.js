const { drizzle } = require('drizzle-orm/postgres-js');
const { pgTable, serial, text, integer, timestamp, boolean, jsonb, index, unique } = require('drizzle-orm/pg-core');
const postgres = require('postgres');

// 连接数据库
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:uWNZugjBqixf8dxC@localhost:5432/lobechat";
const client = postgres(connectionString);
const db = drizzle(client);

// 定义 userExtensions 表结构（与schema文件保持一致）
const userExtensions = pgTable('user_extensions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  currentPlan: text('current_plan').notNull().default('free'),
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
  monthlyTokenLimit: integer('monthly_token_limit').notNull().default(0),
  monthlyApiCallsLimit: integer('monthly_api_calls_limit').notNull().default(0),
  monthlyStorageLimit: integer('monthly_storage_limit').notNull().default(1024),
  currentTokensUsed: integer('current_tokens_used').notNull().default(0),
  currentApiCallsUsed: integer('current_api_calls_used').notNull().default(0),
  currentStorageUsed: integer('current_storage_used').notNull().default(0),
  lastUsageReset: timestamp('last_usage_reset', { withTimezone: true }).defaultNow(),
  features: jsonb('features').default({
    basicChat: true,
    fileUpload: false,
    advancedModel: false,
    exportHistory: false,
    prioritySupport: false,
    customAgents: false,
    apiAccess: false,
  }),
  isSuspended: boolean('is_suspended').notNull().default(false),
  suspendReason: text('suspend_reason'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('user_extensions_user_id_idx').on(table.userId),
}));

async function createUserExtensionsTable() {
  try {
    console.log('正在检查/创建 user_extensions 表...');

    // 检查表是否已存在
    const tableExists = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_extensions'
      );
    `;

    if (tableExists[0].exists) {
      console.log('✅ user_extensions 表已存在');

      // 检查是否有缺失的列
      const columns = await client`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'user_extensions'
        ORDER BY ordinal_position;
      `;

      const columnNames = columns.map(col => col.column_name);
      console.log('当前表列:', columnNames);

      // 检查是否缺少 monthly_storage_limit 列
      if (!columnNames.includes('monthly_storage_limit')) {
        console.log('添加缺失的 monthly_storage_limit 列...');
        await client`
          ALTER TABLE user_extensions
          ADD COLUMN monthly_storage_limit INTEGER NOT NULL DEFAULT 1024;
        `;
        console.log('✅ monthly_storage_limit 列已添加');
      }

      // 检查其他必需的列
      const requiredColumns = [
        'id', 'user_id', 'current_plan', 'plan_expires_at',
        'monthly_token_limit', 'monthly_api_calls_limit', 'monthly_storage_limit',
        'current_tokens_used', 'current_api_calls_used', 'current_storage_used',
        'last_usage_reset', 'features', 'is_suspended', 'suspend_reason',
        'admin_notes', 'created_at', 'updated_at'
      ];

      for (const col of requiredColumns) {
        if (!columnNames.includes(col)) {
          console.log(`⚠️ 缺少列: ${col}`);
        }
      }

    } else {
      console.log('创建 user_extensions 表...');

      // 使用Drizzle创建表
      await db.execute(`
        CREATE TABLE user_extensions (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          current_plan TEXT NOT NULL DEFAULT 'free',
          plan_expires_at TIMESTAMP WITH TIME ZONE,
          monthly_token_limit INTEGER NOT NULL DEFAULT 0,
          monthly_api_calls_limit INTEGER NOT NULL DEFAULT 0,
          monthly_storage_limit INTEGER NOT NULL DEFAULT 1024,
          current_tokens_used INTEGER NOT NULL DEFAULT 0,
          current_api_calls_used INTEGER NOT NULL DEFAULT 0,
          current_storage_used INTEGER NOT NULL DEFAULT 0,
          last_usage_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          features JSONB DEFAULT '{"basicChat":true,"fileUpload":false,"advancedModel":false,"exportHistory":false,"prioritySupport":false,"customAgents":false,"apiAccess":false}',
          is_suspended BOOLEAN NOT NULL DEFAULT false,
          suspend_reason TEXT,
          admin_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // 创建索引
      await db.execute(`
        CREATE INDEX user_extensions_user_id_idx ON user_extensions(user_id);
      `);

      console.log('✅ user_extensions 表创建成功');
    }

    // 验证表结构
    const finalColumns = await client`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_extensions'
      ORDER BY ordinal_position;
    `;

    console.log('\n📋 最终表结构:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (默认: ${col.column_default || 'NULL'})`);
    });

  } catch (error) {
    console.error('❌ 创建表失败:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// 运行脚本
createUserExtensionsTable()
  .then(() => {
    console.log('\n🎉 user_extensions 表准备完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 执行失败:', error);
    process.exit(1);
  });