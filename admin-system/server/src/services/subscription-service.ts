import { db } from '../config/database';
import { subscriptionPlans, NewSubscriptionPlan } from '../db/subscription-schema';
import { eq, desc } from 'drizzle-orm';

// Temporary manually importing schema if not available in ../db/schemas yet
// In a real scenario, we should export them from admin-system/server/src/db/schemas.ts
// But since we just added them to packages/database, we might need to import from there or replicate definition.
// For Admin System, let's assume valid imports or I'll define types here if needed.
// Checking recent file list shows I haven't updated admin-system schemas yet.
// I should probably update admin-system schema imports or just use raw sql/drizzle if direct import is tricky.
// Let's use direct import from packages/database if possible, or define locally.
// Admin server seems to use its own schema definitions in `src/db`.
// I should check `src/db/index.ts` in admin server.

// Let's rely on standard drizzle operations.

export class SubscriptionService {

    // Get all plans
    async getAllPlans() {
        // We need to query the subscription_plans table. 
        // Since I cannot easily import the schema object from packages/database (monorepo linking might be complex in this env),
        // I will trust that I can import it if I configured paths correctly.
        // If not, I'll use SQL query.

        // Actually, the previous `stats.ts` used `sql` tag. I can use that for safety.
        // But for CRUD, Drizzle ORM objects are better.
        // Let's assume I can import from `packages/database`.
        // Wait, the admin server is a separate legacy express app, might not be able to import from workspace packages easily without build.
        // I'll check `admin-system/server/package.json` dependencies.

        // Re-checking imports.
        // `admin-system/server/src/services/usage-service.ts` imports from `../db/user-extensions-schema`.
        // I should probably define the schema locally in `admin-system/server/src/db/subscription-schema.ts` to be safe and consistent with current patterns.
        return await db.select().from(subscriptionPlans).orderBy(desc(subscriptionPlans.createdAt));
    }

    // Get plan by ID
    async getPlanById(id: string) {
        const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
        return result[0] || null;
    }

    // Create plan
    async createPlan(data: NewSubscriptionPlan) {
        const result = await db.insert(subscriptionPlans).values(data).returning();
        return result[0];
    }

    // Update plan
    async updatePlan(id: string, data: Partial<NewSubscriptionPlan>) {
        // 过滤掉不应该被更新的字段
        const { id: _id, createdAt, updatedAt, ...updateData } = data as any;
        const result = await db.update(subscriptionPlans)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(subscriptionPlans.id, id))
            .returning();
        return result[0];
    }

    // Delete plan
    async deletePlan(id: string) {
        await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
        return true;
    }
}

export const subscriptionService = new SubscriptionService();
