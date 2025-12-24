import { db } from '../config/database';
import { sql } from 'drizzle-orm';

async function queryDatabaseStructure() {
  try {
    console.log('# 数据库表结构分析\n');

    // 获取当前数据库连接信息
    const currentDB = await db.execute(sql`SELECT current_database() as db_name`);
    console.log(`## 当前连接数据库: ${currentDB[0].db_name}\n`);

    // 获取所有表
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('## 所有表列表\n');
    console.log('| 表名 |');
    console.log('|------|');
    tables.forEach(table => {
      console.log(`| ${table.table_name} |`);
    });

    console.log('\n---\n');

    // 获取每个表的详细结构
    for (const table of tables) {
      console.log(`### ${table.table_name}\n`);

      const columns = await db.execute(sql`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table.table_name}'
        ORDER BY ordinal_position
      `);

      console.log('| 字段名 | 数据类型 | 可空 | 默认值 | 最大长度 | 精度 |');
      console.log('|--------|----------|------|--------|----------|------|');

      columns.forEach(col => {
        const maxLength = col.character_maximum_length || col.numeric_precision || '-';
        const precision = col.numeric_scale || '-';
        const defaultValue = col.column_default || '-';

        console.log(`| ${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${defaultValue} | ${maxLength} | ${precision} |`);
      });

      // 获取索引信息
      const indexes = await db.execute(sql`
        SELECT
          indexname as index_name,
          indexdef as index_definition
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = '${table.table_name}'
        ORDER BY indexname
      `);

      if (indexes.length > 0) {
        console.log('\n**索引:**');
        indexes.forEach(idx => {
          console.log(`- ${idx.index_name}: ${idx.index_definition}`);
        });
      }

      console.log('\n---\n');
    }

  } catch (error) {
    console.error('查询数据库结构失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  queryDatabaseStructure();
}

export { queryDatabaseStructure };