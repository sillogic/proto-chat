import { db } from '../config/database';
import { modelPricings, NewModelPricing } from '../db/subscription-schema';
import { aiProviders } from '../db/ai-providers-schema';
import { eq, desc, and } from 'drizzle-orm';
// @ts-ignore - workspace package with type issues
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';
import { idGenerator } from '../utils/id-generator';

const SYNC_MULTIPLIER = 500000; // 1 USD = 500,000 Credits
const CNY_TO_USD = 1 / 7.15;

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

    // Sync with model-bank
    async syncWithModelBank() {
        // 1. Clear existing pricings
        await db.delete(modelPricings);

        // 2. Fetch enabled global providers
        const enabledProviders = await db
            .select()
            .from(aiProviders)
            .where(and(eq(aiProviders.enabled, true), eq(aiProviders.isGlobal, true)));

        // Use a map to deduplicate (model, provider) pairs
        const pricingMap = new Map<string, NewModelPricing>();

        for (const provider of enabledProviders) {
            // Get enabled models for this provider
            const settings = (provider.settings || {}) as any;
            const enabledModelIds = settings.enabledModels as string[] | undefined;

            for (const model of LOBE_DEFAULT_MODEL_LIST as any[]) {
                // Determine if model belongs to this provider
                if (model.providerId !== provider.id) continue;

                // Check if enabled
                const isEnabled = enabledModelIds ? enabledModelIds.includes(model.id) : model.enabled;
                if (!isEnabled) continue;

                const key = `${model.id}-${provider.id}`;
                if (pricingMap.has(key)) continue;

                if (!model.pricing || !model.pricing.units) continue;

                const inputUnit = model.pricing.units.find((u: any) => u.name === 'textInput');
                const outputUnit = model.pricing.units.find((u: any) => u.name === 'textOutput');

                if (!inputUnit || !outputUnit) continue;

                const getRate = (unit: any) => {
                    if (unit.strategy === 'fixed') return unit.rate;
                    if (unit.strategy === 'lookup' && unit.lookup?.prices) {
                        const prices = Object.values(unit.lookup.prices) as number[];
                        return prices[0] || 0;
                    }
                    return 0;
                };

                let inputUSD = getRate(inputUnit);
                let outputUSD = getRate(outputUnit);

                if (model.pricing.currency === 'CNY') {
                    inputUSD *= CNY_TO_USD;
                    outputUSD *= CNY_TO_USD;
                }

                pricingMap.set(key, {
                    id: idGenerator('mp'),
                    model: model.id,
                    provider: provider.id,
                    inputPrice: (Math.ceil(inputUSD * SYNC_MULTIPLIER * 100) / 100).toFixed(2),
                    outputPrice: (Math.ceil(outputUSD * SYNC_MULTIPLIER * 100) / 100).toFixed(2),
                    perRequestPrice: '0',
                    memo: `Auto-synced from model-bank (${model.pricing.currency} -> Credits)`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any);
            }
        }

        const newPricings = Array.from(pricingMap.values());

        if (newPricings.length > 0) {
            await db.insert(modelPricings).values(newPricings);
        }

        return { count: newPricings.length };
    }
}

export const pricingService = new PricingService();
