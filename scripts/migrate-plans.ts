import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { sql } from 'drizzle-orm';

dotenv.config();

interface OldPlan {
  id: string;
  name: string;
  slug: string;
  type: string;
  price: number;
  interval: 'month' | 'year';
  credits: string;
  storage_limit: number;
  vector_limit: number;
  features: any;
  is_active: boolean;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

const runMigration = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle(client);

  try {
    console.log('🚀 Starting subscription plans migration...');

    // 1. Query all existing plans
    const existingPlans = await client.query<OldPlan>(`
      SELECT * FROM subscription_plans ORDER BY name, interval
    `);

    console.log(`📊 Found ${existingPlans.rows.length} existing plans`);

    // Group plans by base name (without -monthly/-yearly suffix)
    const planGroups = new Map<string, { monthly?: OldPlan; yearly?: OldPlan }>();

    for (const plan of existingPlans.rows) {
      // Extract base name (remove -monthly, -yearly, -annual suffixes)
      let baseName = plan.name;
      let baseSlug = plan.slug;

      // Remove interval suffixes from name
      baseName = baseName.replace(/\s+(Monthly|Yearly|Annual)$/i, '').trim();

      // Remove interval suffixes from slug
      baseSlug = baseSlug.replace(/-(monthly|yearly|annual)$/i, '');

      if (!planGroups.has(baseSlug)) {
        planGroups.set(baseSlug, {});
      }

      const group = planGroups.get(baseSlug)!;
      if (plan.interval === 'month') {
        group.monthly = plan;
      } else if (plan.interval === 'year') {
        group.yearly = plan;
      }
    }

    console.log(`📦 Grouped into ${planGroups.size} plan groups`);

    // 2. Start transaction for migration
    await client.query('BEGIN');

    const mergedPlans: { oldIds: string[]; newId: string; newSlug: string }[] = [];

    for (const [baseSlug, group] of planGroups.entries()) {
      const { monthly, yearly } = group;

      if (!monthly && !yearly) {
        console.log(`⚠️  Skipping empty group: ${baseSlug}`);
        continue;
      }

      // Use monthly plan as base (or yearly if monthly doesn't exist)
      const basePlan = monthly || yearly!;
      const oldIds: string[] = [];

      // Determine the merged plan data
      const monthlyPrice = monthly?.price ?? 0;
      const yearlyPrice = yearly?.price ?? null;

      // Generate new ID if needed
      const newId = baseSlug === 'free' || baseSlug === 'free-trial' ? 'plan_free' : basePlan.id;

      // Extract clean name
      let cleanName = basePlan.name.replace(/\s+(Monthly|Yearly|Annual)$/i, '').trim();

      console.log(`\n🔄 Merging plan: ${cleanName}`);
      console.log(`   Base slug: ${baseSlug}`);
      console.log(`   Monthly price: ${monthlyPrice}`);
      console.log(`   Yearly price: ${yearlyPrice}`);

      // Check if this is a new schema plan that already exists
      const checkExisting = await client.query(
        'SELECT id FROM subscription_plans WHERE slug = $1 AND monthly_price IS NOT NULL',
        [baseSlug]
      );

      if (checkExisting.rows.length > 0) {
        console.log(`   ✅ Plan already migrated, skipping`);
        continue;
      }

      // Collect old IDs
      if (monthly) oldIds.push(monthly.id);
      if (yearly) oldIds.push(yearly.id);

      // Insert or update the merged plan
      await client.query(`
        INSERT INTO subscription_plans (
          id, name, slug, type, monthly_price, yearly_price, currency,
          credits, storage_limit, vector_limit, features, is_active,
          display_order, is_popular, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT (slug) DO UPDATE SET
          monthly_price = EXCLUDED.monthly_price,
          yearly_price = EXCLUDED.yearly_price,
          name = EXCLUDED.name
      `, [
        newId,
        cleanName,
        baseSlug,
        basePlan.type,
        monthlyPrice,
        yearlyPrice,
        basePlan.currency,
        basePlan.credits,
        basePlan.storage_limit,
        basePlan.vector_limit,
        JSON.stringify(basePlan.features || {}),
        basePlan.is_active,
        0, // display_order - will be set manually later
        false, // is_popular - will be set manually later
        basePlan.created_at,
        new Date(),
      ]);

      mergedPlans.push({ oldIds, newId, newSlug: baseSlug });

      console.log(`   ✅ Merged plan created/updated with ID: ${newId}`);
    }

    // 3. Update user_extensions references
    console.log('\n📝 Updating user_extensions references...');
    for (const { oldIds, newId } of mergedPlans) {
      for (const oldId of oldIds) {
        if (oldId !== newId) {
          const result = await client.query(
            'UPDATE user_extensions SET plan_id = $1 WHERE plan_id = $2',
            [newId, oldId]
          );
          if (result.rowCount && result.rowCount > 0) {
            console.log(`   ✅ Updated ${result.rowCount} user_extensions records: ${oldId} → ${newId}`);
          }
        }
      }
    }

    // 4. Update user_subscription_history references
    console.log('\n📝 Updating user_subscription_history references...');
    for (const { oldIds, newId } of mergedPlans) {
      for (const oldId of oldIds) {
        if (oldId !== newId) {
          const result = await client.query(
            'UPDATE user_subscription_history SET plan_id = $1 WHERE plan_id = $2',
            [newId, oldId]
          );
          if (result.rowCount && result.rowCount > 0) {
            console.log(`   ✅ Updated ${result.rowCount} history records: ${oldId} → ${newId}`);
          }
        }
      }
    }

    // 5. Delete old plan rows (only if they were merged into different IDs)
    console.log('\n🗑️  Removing old plan rows...');
    for (const { oldIds, newId } of mergedPlans) {
      for (const oldId of oldIds) {
        if (oldId !== newId) {
          // Check if this old plan still has the old schema (has interval column)
          const checkOld = await client.query(
            'SELECT interval FROM subscription_plans WHERE id = $1',
            [oldId]
          );

          if (checkOld.rows.length > 0 && checkOld.rows[0].interval) {
            await client.query('DELETE FROM subscription_plans WHERE id = $1', [oldId]);
            console.log(`   ✅ Deleted old plan: ${oldId}`);
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
};

// Verification script
const verifyMigration = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('\n🔍 Verifying migration...');

    // Check for plans with old schema
    const oldSchemaPlan = await client.query(`
      SELECT COUNT(*) as count FROM subscription_plans
      WHERE monthly_price IS NULL OR interval IS NOT NULL
    `);

    if (parseInt(oldSchemaPlan.rows[0].count) > 0) {
      console.log(`⚠️  Warning: Found ${oldSchemaPlan.rows[0].count} plans still using old schema`);
    } else {
      console.log('✅ All plans migrated to new schema');
    }

    // Check for orphaned references
    const orphanedUsers = await client.query(`
      SELECT COUNT(*) as count FROM user_extensions
      WHERE plan_id NOT IN (SELECT id FROM subscription_plans)
    `);

    if (parseInt(orphanedUsers.rows[0].count) > 0) {
      console.log(`⚠️  Warning: Found ${orphanedUsers.rows[0].count} users with invalid plan_id`);
    } else {
      console.log('✅ All user plan references are valid');
    }

    console.log('\n✅ Verification completed!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await client.end();
  }
};

// Run migration
if (process.argv.includes('--verify')) {
  verifyMigration();
} else {
  runMigration();
}
