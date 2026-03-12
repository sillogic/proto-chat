import dotenv from 'dotenv';
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

dotenv.config({ override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined');
  process.exit(1);
}

const client = postgres(connectionString, { connect_timeout: 10 });

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ migrations 目录不存在:', migrationsDir);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 按文件名字母序执行，001_ 在 002_ 之前

  if (files.length === 0) {
    console.log('ℹ️  没有找到 .sql 迁移文件');
    return;
  }

  console.log(`🗄️  找到 ${files.length} 个迁移文件，开始执行...\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`▶  执行: ${file}`);
    try {
      await client.unsafe(sql);
      console.log(`✅ 完成: ${file}\n`);
    } catch (error: any) {
      console.error(`❌ 失败: ${file}`);
      console.error(error.message);
      await client.end();
      process.exit(1);
    }
  }

  console.log('🎉 所有迁移执行完毕');
}

runMigrations().finally(() => client.end());
