#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

async function removeGlobalProviders() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Removing all global providers except ProtoChat...\n');

    // Step 1: Check current state
    console.log('=== Before removal ===');
    const beforeResult = await pool.query(`
      SELECT id, name, enabled, is_global
      FROM ai_providers
      WHERE user_id = 'system_admin' AND is_global = true
      ORDER BY id
    `);
    console.log(`Total global providers: ${beforeResult.rows.length}`);
    console.table(beforeResult.rows);

    // Step 2: Delete all except ProtoChat
    const deleteResult = await pool.query(`
      DELETE FROM ai_providers
      WHERE user_id = 'system_admin'
        AND is_global = true
        AND id != 'protochat'
    `);
    console.log(`\n✓ Deleted ${deleteResult.rowCount} global providers\n`);

    // Step 3: Verify
    console.log('=== After removal ===');
    const afterResult = await pool.query(`
      SELECT id, name, enabled, is_global
      FROM ai_providers
      WHERE user_id = 'system_admin' AND is_global = true
      ORDER BY id
    `);
    console.log(`Total global providers: ${afterResult.rows.length}`);
    console.table(afterResult.rows);

    if (afterResult.rows.length === 1 && afterResult.rows[0].id === 'protochat') {
      console.log('\n✅ Success! Only ProtoChat remains as global provider.');
    } else {
      console.log('\n⚠️  Warning: Expected only ProtoChat, but found:', afterResult.rows);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

removeGlobalProviders();
