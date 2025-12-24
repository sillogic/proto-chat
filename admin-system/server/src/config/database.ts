import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import * as userExtensionsSchema from '../db/user-extensions-schema';
import * as aiProvidersSchema from '../db/ai-providers-schema';

// 创建数据库连接
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const client = postgres(connectionString);
export const db = drizzle(client, {
  schema: { ...schema, ...userExtensionsSchema, ...aiProvidersSchema }
});

// 检查并创建表的函数
export async function checkAndCreateTables() {
  try {
    // 确保users表存在（主项目用户表）
    const usersTableExists = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `;

    if (!usersTableExists[0].exists) {
      console.log('⚠️ users table does not exist. Please ensure the main project database is set up correctly.');
    } else {
      console.log('✅ users table exists');
    }

    return true;
  } catch (error) {
    console.error('Error checking tables:', error);
    return false;
  }
}

export default db;