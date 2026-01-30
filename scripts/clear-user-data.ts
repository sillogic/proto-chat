/**
 * 用户数据清理脚本
 * 用于 Casdoor -> Better Auth 迁移
 *
 * 执行方式: bun run scripts/clear-user-data.ts
 *
 * 警告：此脚本会删除所有用户数据，请确保已备份！
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// 从环境变量读取数据库连接
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL 环境变量未设置');
  process.exit(1);
}

console.log('🔗 连接数据库...');
const pool = new Pool({ connectionString });
const db = drizzle(pool);

// 需要清理的表（按依赖顺序）
const tablesToClear = [
  // 1. Better Auth 认证相关
  'passkey',
  'two_factor',
  'verifications',
  'accounts',
  'auth_sessions',

  // 2. 图片生成相关（AI 绘图）
  'generations',
  'generation_batches',
  'generation_topics',

  // 3. RAG/Embedding 相关
  'embedding_usage_logs',
  'document_chunks',
  'embeddings',
  'unstructured_chunks',
  'chunks',

  // 4. 用户记忆相关
  'user_memories_experiences',
  'user_memories_identities',
  'user_memories_preferences',
  'user_memories_contexts',
  'user_memories',

  // 5. 消息相关
  'message_semantic_search_chunks',
  'message_query_chunks',
  'message_queries',
  'message_translates',
  'message_tts',
  'message_plugins',
  'messages',
  'message_groups',

  // 6. 话题/线程相关
  'thread_messages',
  'threads',
  'topics',

  // 7. 会话相关（聊天会话）
  'sessions',
  'session_groups',

  // 8. 聊天组相关
  'chat_groups_agents',
  'chat_groups',

  // 9. Agent 相关
  'agents_files',
  'agents_tags',
  'agents',

  // 10. 文件/知识库相关
  'knowledge_base_files',
  'knowledge_bases',
  'files',
  'documents',

  // 11. AI 模型/提供商配置
  'ai_models',
  'ai_providers',

  // 12. 积分/支付相关
  'user_transactions',
  'user_balances',
  'payment_orders',

  // 13. 用户扩展相关
  'user_installed_plugins',
  'user_settings',
  'user_extensions',

  // 14. RBAC 相关
  'rbac_user_roles',

  // 15. API Keys
  'api_keys',

  // 16. 异步任务
  'async_tasks',

  // 17. 用户主表（最后删除）
  'users',
];

async function clearTable(tableName: string): Promise<{ success: boolean; count: number }> {
  try {
    // 先检查表是否存在
    const checkResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ) as exists
    `);

    const tableExists = checkResult.rows[0]?.exists;

    if (!tableExists) {
      return { success: true, count: 0 };
    }

    // 获取删除前的记录数
    const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
    const count = parseInt(countResult.rows[0]?.count as string, 10) || 0;

    if (count === 0) {
      return { success: true, count: 0 };
    }

    // 删除数据
    await db.execute(sql.raw(`DELETE FROM "${tableName}"`));

    return { success: true, count };
  } catch (error) {
    console.error(`  ❌ 清理 ${tableName} 失败:`, (error as Error).message);
    return { success: false, count: 0 };
  }
}

async function main() {
  console.log('');
  console.log('⚠️  警告：此脚本将删除所有用户数据！');
  console.log('');
  console.log('📋 开始清理用户数据...');
  console.log('');

  let totalDeleted = 0;
  let failedTables: string[] = [];

  for (const table of tablesToClear) {
    const { success, count } = await clearTable(table);

    if (!success) {
      failedTables.push(table);
    } else if (count > 0) {
      console.log(`  ✅ ${table}: 删除 ${count} 条记录`);
      totalDeleted += count;
    }
  }

  console.log('');
  console.log('=' .repeat(50));
  console.log(`📊 清理完成！共删除 ${totalDeleted} 条记录`);

  if (failedTables.length > 0) {
    console.log(`⚠️  以下表清理失败: ${failedTables.join(', ')}`);
  }

  // 验证清理结果
  console.log('');
  console.log('📋 验证清理结果:');

  const verifyTables = ['users', 'auth_sessions', 'accounts', 'user_extensions', 'user_balances', 'messages', 'generations', 'embeddings'];

  for (const table of verifyTables) {
    try {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}"`));
      const count = result.rows[0]?.count || 0;
      console.log(`  ${table}: ${count} 条记录`);
    } catch {
      // 表可能不存在，忽略
    }
  }

  console.log('');
  console.log('✅ 用户数据清理完成！');
  console.log('');
  console.log('下一步:');
  console.log('  1. 重启开发服务器: bun run dev');
  console.log('  2. 访问 http://localhost:3010 测试注册');
  console.log('');

  await pool.end();
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
