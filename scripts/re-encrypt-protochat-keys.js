#!/usr/bin/env node
/**
 * Re-encrypt ProtoChat provider API keys using the main project's encryption key
 *
 * This script:
 * 1. Decrypts data using the OLD key (admin-system/.env)
 * 2. Re-encrypts using the NEW key (root .env)
 */

const { Pool } = require('pg');
const path = require('path');

async function reEncryptKeys() {
  // Load admin system env first (to decrypt old data)
  require('dotenv').config({ path: path.join(__dirname, '../admin-system/server/.env') });
  const oldKey = process.env.KEY_VAULTS_SECRET;

  if (!oldKey) {
    console.error('❌ OLD KEY_VAULTS_SECRET not found in admin-system/server/.env');
    process.exit(1);
  }

  console.log('Old key (admin):', oldKey.substring(0, 10) + '...' + oldKey.substring(oldKey.length - 10));

  // Load KeyVaultsGateKeeper
  const KeyVaultsGateKeeperModule = require('../src/server/modules/KeyVaultsEncrypt/index.ts');
  const KeyVaultsGateKeeper = KeyVaultsGateKeeperModule.KeyVaultsGateKeeper;

  // Initialize with OLD key
  const oldGateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();

  // Now load main project env (for new encryption)
  delete process.env.KEY_VAULTS_SECRET;
  require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
  const newKey = process.env.KEY_VAULTS_SECRET;

  if (!newKey) {
    console.error('❌ NEW KEY_VAULTS_SECRET not found in root .env');
    process.exit(1);
  }

  console.log('New key (main):', newKey.substring(0, 10) + '...' + newKey.substring(newKey.length - 10));

  if (oldKey === newKey) {
    console.log('✅ Keys are already the same, no re-encryption needed');
    process.exit(0);
  }

  // Initialize with NEW key
  const newGateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();

  // Connect to database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Fetch all providers with encrypted keys
    const result = await pool.query(`
      SELECT id, name, api_key
      FROM protochat_providers
      WHERE api_key IS NOT NULL
    `);

    console.log(`\nFound ${result.rows.length} providers with API keys\n`);

    for (const row of result.rows) {
      console.log(`Processing: ${row.name} (${row.id})`);

      try {
        // Decrypt with OLD key
        const { wasAuthentic, plaintext } = await oldGateKeeper.decrypt(row.api_key);

        if (!wasAuthentic) {
          console.error(`  ❌ Failed to decrypt with old key (authentication failed)`);
          continue;
        }

        console.log(`  ✓ Decrypted successfully`);
        console.log(`  Plaintext: ${plaintext.substring(0, 50)}...`);

        // Re-encrypt with NEW key
        const newEncrypted = await newGateKeeper.encrypt(plaintext);
        console.log(`  ✓ Re-encrypted (length: ${newEncrypted.length})`);

        // Update database
        await pool.query(
          'UPDATE protochat_providers SET api_key = $1, updated_at = NOW() WHERE id = $2',
          [newEncrypted, row.id]
        );

        console.log(`  ✓ Updated in database\n`);

        // Verify
        const { wasAuthentic: verifyAuth } = await newGateKeeper.decrypt(newEncrypted);
        if (verifyAuth) {
          console.log(`  ✅ Verification successful\n`);
        } else {
          console.error(`  ⚠️  Verification failed!\n`);
        }
      } catch (error) {
        console.error(`  ❌ Error:`, error.message, '\n');
      }
    }

    console.log('✅ Re-encryption complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

reEncryptKeys().catch(console.error);
