#!/usr/bin/env node
require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { protochatModels, protochatProviders, aiProviders } = require('../packages/database/src/schemas');
const { eq, and } = require('drizzle-orm');

async function debugFrontendModelData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log('=== Simulating frontend model fetch ===\n');

    // Step 1: Check global ProtoChat provider
    console.log('1. Global ProtoChat provider:');
    const globalProvider = await db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.id, 'protochat'), eq(aiProviders.userId, 'system_admin'), eq(aiProviders.isGlobal, true)));

    console.table(globalProvider.map(p => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      isGlobal: p.isGlobal,
    })));

    // Step 2: Fetch ProtoChat models (simulating fetchProtoChatModels)
    console.log('\n2. ProtoChat models from database:');
    const models = await db
      .select({
        id: protochatModels.id,
        displayName: protochatModels.displayName,
        type: protochatModels.type,
        originalProvider: protochatModels.originalProvider,
      })
      .from(protochatModels)
      .innerJoin(
        protochatProviders,
        eq(protochatModels.originalProvider, protochatProviders.id),
      )
      .where(
        and(
          eq(protochatModels.enabled, true),
          eq(protochatProviders.enabled, true),
        ),
      );

    console.log(`Found ${models.length} enabled ProtoChat models:`);
    console.table(models);

    // Step 3: Simulate frontend data structure
    console.log('\n3. Frontend data structure (what enabledList should contain):');

    const frontendData = {
      provider: {
        id: 'protochat',
        name: 'ProtoChat',
        enabled: globalProvider[0]?.enabled || false,
      },
      models: models.map(m => ({
        id: m.id,
        displayName: m.displayName,
        type: m.type,
        providerId: 'protochat',  // ✅ This should be 'protochat'
        originalProvider: m.originalProvider, // Just for debugging
      })),
    };

    console.log('Provider:', frontendData.provider);
    console.log(`\nModels (${frontendData.models.length}):`);
    console.table(frontendData.models);

    console.log('\n4. Expected Select options:');
    frontendData.models.forEach(model => {
      console.log(`  - value: "protochat/${model.id}"`);
      console.log(`    provider: "protochat"`);
      console.log(`    label: "${model.displayName}"`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugFrontendModelData();
