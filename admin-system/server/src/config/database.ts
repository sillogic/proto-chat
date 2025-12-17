import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

// 创建数据库连接
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// 检查并创建表的函数
export async function checkAndCreateTables() {
  try {
    // 检查 admin_users 表是否存在
    const tableExists = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'admin_users'
      );
    `;

    if (!tableExists[0].exists) {
      console.log('admin_users table does not exist, creating...');

      // 创建 admin_users 表
      await client`
        CREATE TABLE admin_users (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          role TEXT DEFAULT 'admin' NOT NULL,
          permissions JSONB DEFAULT '[]' NOT NULL,
          is_active BOOLEAN DEFAULT true NOT NULL,
          last_login_at TIMESTAMP,
          casdoor_id TEXT,
          auth_method TEXT DEFAULT 'local' NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `;

      console.log('✅ admin_users table created successfully');
    } else {
      console.log('admin_users table already exists');

      // 检查是否有缺失的列
      const columns = await client`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'admin_users';
      `;

      const existingColumns = columns.map(col => col.column_name);
      const requiredColumns = ['casdoor_id', 'auth_method'];

      for (const column of requiredColumns) {
        if (!existingColumns.includes(column)) {
          console.log(`Adding missing column: ${column}`);
          if (column === 'casdoor_id') {
            await client`ALTER TABLE admin_users ADD COLUMN casdoor_id TEXT;`;
          } else if (column === 'auth_method') {
            await client`ALTER TABLE admin_users ADD COLUMN auth_method TEXT DEFAULT 'local' NOT NULL;`;
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking/creating tables:', error);
    return false;
  }
}

export default db;