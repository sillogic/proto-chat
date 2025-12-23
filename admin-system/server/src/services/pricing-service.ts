import { db } from '../config/database';
import { modelPricings, NewModelPricing } from '../db/subscription-schema';
import { eq, desc } from 'drizzle-orm';

export class PricingService {

    // Get all model pricings
    async getAllPricings() {
        return await db.select().from(modelPricings).orderBy(desc(modelPricings.updatedAt));
    }

    // Get pricing by ID
    async getPricingById(id: string) {
        const result = await db.select().from(modelPricings).where(eq(modelPricings.id, id));
        return result[0] || null;
    }

    // Create pricing
    async createPricing(data: NewModelPricing) {
        const result = await db.insert(modelPricings).values(data).returning();
        return result[0];
    }

    // Update pricing
    async updatePricing(id: string, data: Partial<NewModelPricing>) {
        const result = await db.update(modelPricings)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(modelPricings.id, id))
            .returning();
        return result[0];
    }

    // Delete pricing
    async deletePricing(id: string) {
        await db.delete(modelPricings).where(eq(modelPricings.id, id));
        return true;
    }
}

export const pricingService = new PricingService();
