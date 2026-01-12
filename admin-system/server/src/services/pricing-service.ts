import { db } from '../config/database';
import { modelPricings, NewModelPricing } from '../db/subscription-schema';
import { aiProviders, aiModels } from '../db/ai-providers-schema';
import { protochatProviders, protochatSettings, protochatModels, protochatModelPricing } from '../db/protochat-schema';
import { eq, desc, and } from 'drizzle-orm';
// @ts-ignore - workspace package with type issues
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';
import { idGenerator } from '../utils/id-generator';

const SYNC_MULTIPLIER = 500000; // 1 USD = 500,000 Credits
const CNY_TO_USD = 1 / 7.15;
const DEFAULT_PRICING_MULTIPLIER = 1.0; // 默认定价系数

export class PricingService {

    // Get pricing multiplier from settings
    private async getPricingMultiplier(): Promise<number> {
        const result = await db
            .select()
            .from(protochatSettings)
            .where(eq(protochatSettings.id, 'pricing_multiplier'))
            .limit(1);

        if (result.length > 0 && result[0].value) {
            return parseFloat(result[0].value);
        }

        return DEFAULT_PRICING_MULTIPLIER;
    }

    // Update all model user prices when multiplier changes
    async updateAllUserPrices(newMultiplier: number) {
        const allPricings = await db.select().from(modelPricings);

        for (const pricing of allPricings) {
            const costInputPrice = parseFloat(pricing.inputPrice);
            const costOutputPrice = parseFloat(pricing.outputPrice);

            await db.update(modelPricings)
                .set({
                    userInputPrice: (costInputPrice * newMultiplier).toFixed(6),
                    userOutputPrice: (costOutputPrice * newMultiplier).toFixed(6),
                    updatedAt: new Date(),
                })
                .where(eq(modelPricings.id, pricing.id));
        }

        return { updated: allPricings.length };
    }

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
        // 1. Get pricing multiplier first
        const multiplier = await this.getPricingMultiplier();
        console.log(`[Pricing Sync] Using pricing multiplier: ${multiplier}`);

        // 2. Clear existing pricings
        await db.delete(modelPricings);

        // 3. Fetch enabled global providers
        const enabledProviders = await db
            .select()
            .from(aiProviders)
            .where(and(eq(aiProviders.enabled, true), eq(aiProviders.isGlobal, true)));

        // Use a map to deduplicate (model, provider, subProvider) tuples
        const pricingMap = new Map<string, NewModelPricing>();

        for (const provider of enabledProviders) {
            // Special handling for ProtoChat
            if (provider.id === 'protochat') {
                await this.syncProtoChatPricing(pricingMap, multiplier);
                continue;
            }

            // Normal provider handling - read from database
            const providerModels = await db
                .select()
                .from(aiModels)
                .where(and(
                    eq(aiModels.providerId, provider.id),
                    eq(aiModels.userId, 'system_admin'),
                    eq(aiModels.enabled, true)
                ));

            console.log(`[Pricing Sync] Found ${providerModels.length} enabled models for provider ${provider.id}`);

            for (const model of providerModels) {
                const key = `${model.id}-${provider.id}-null`;
                if (pricingMap.has(key)) continue;

                // Parse pricing from database
                const pricing = model.pricing as any;
                if (!pricing || typeof pricing.inputPrice !== 'number' || typeof pricing.outputPrice !== 'number') {
                    console.warn(`[Pricing Sync] Model ${model.id} has no valid pricing in database`);
                    continue;
                }

                // Database stores pricing in USD per 1M tokens
                // Calculate cost price in credits
                const costInputPrice = Math.ceil(pricing.inputPrice * SYNC_MULTIPLIER * 100) / 100;
                const costOutputPrice = Math.ceil(pricing.outputPrice * SYNC_MULTIPLIER * 100) / 100;

                // Calculate user price = cost price × multiplier
                const userInputPrice = costInputPrice * multiplier;
                const userOutputPrice = costOutputPrice * multiplier;

                pricingMap.set(key, {
                    id: idGenerator('mp'),
                    model: model.id,
                    provider: provider.id,
                    subProvider: null,
                    inputPrice: costInputPrice.toFixed(2),
                    outputPrice: costOutputPrice.toFixed(2),
                    userInputPrice: userInputPrice.toFixed(2),
                    userOutputPrice: userOutputPrice.toFixed(2),
                    perRequestPrice: '0',
                    memo: `Synced from database (${provider.name || provider.id})`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any);
            }
        }

        const newPricings = Array.from(pricingMap.values());

        if (newPricings.length > 0) {
            await db.insert(modelPricings).values(newPricings);
        }

        console.log(`[Pricing Sync] Created ${newPricings.length} pricing entries`);
        return { count: newPricings.length };
    }

    // Sync ProtoChat pricing from sub-providers
    private async syncProtoChatPricing(pricingMap: Map<string, NewModelPricing>, multiplier: number) {
        // Fetch all enabled ProtoChat sub-providers
        const subProviders = await db
            .select()
            .from(protochatProviders)
            .where(eq(protochatProviders.enabled, true));

        // Aggregate all enabled models for aiProviders sync
        const allEnabledModels = new Set<string>();

        for (const subProvider of subProviders) {
            // Fetch enabled models from database for this sub-provider
            const subProviderModels = await db
                .select()
                .from(protochatModels)
                .where(and(
                    eq(protochatModels.originalProvider, subProvider.id),
                    eq(protochatModels.enabled, true)
                ));

            console.log(`[ProtoChat Sync] Found ${subProviderModels.length} enabled models for sub-provider ${subProvider.id}`);

            for (const model of subProviderModels) {
                // Add to aggregate list
                allEnabledModels.add(model.id);

                // Create unique key: model-provider-subProvider
                const key = `${model.id}-protochat-${subProvider.id}`;
                if (pricingMap.has(key)) continue;

                // ProtoChat models have pricing in a separate table
                // Fetch pricing from protochatModelPricing table
                const pricingResults = await db
                    .select()
                    .from(protochatModelPricing)
                    .where(eq(protochatModelPricing.modelId, model.id))
                    .limit(1);

                if (pricingResults.length === 0) {
                    console.warn(`[ProtoChat Sync] Model ${model.id} has no pricing in protochatModelPricing table`);
                    continue;
                }

                const pricing = pricingResults[0];

                // ProtoChat pricing table stores USD prices, need to convert to credits
                // $0.10/M × 500,000 = 50,000 积分/M
                const costInputPriceUSD = parseFloat(pricing.costInputPrice);
                const costOutputPriceUSD = parseFloat(pricing.costOutputPrice);
                const userInputPriceUSD = parseFloat(pricing.userInputPrice);
                const userOutputPriceUSD = parseFloat(pricing.userOutputPrice);

                // Convert to credits
                const costInputPrice = Math.ceil(costInputPriceUSD * SYNC_MULTIPLIER * 100) / 100;
                const costOutputPrice = Math.ceil(costOutputPriceUSD * SYNC_MULTIPLIER * 100) / 100;
                const userInputPrice = Math.ceil(userInputPriceUSD * SYNC_MULTIPLIER * 100) / 100;
                const userOutputPrice = Math.ceil(userOutputPriceUSD * SYNC_MULTIPLIER * 100) / 100;

                pricingMap.set(key, {
                    id: idGenerator('mp'),
                    model: model.id,
                    provider: 'protochat',
                    subProvider: subProvider.id,
                    inputPrice: costInputPrice.toFixed(2),
                    outputPrice: costOutputPrice.toFixed(2),
                    userInputPrice: userInputPrice.toFixed(2),
                    userOutputPrice: userOutputPrice.toFixed(2),
                    perRequestPrice: '0',
                    memo: `ProtoChat (${subProvider.name || subProvider.id})`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any);
            }
        }

        // Note: 不再需要同步到 aiProviders 表的 settings.enabledModels
        // 主项目直接从 protochat_models.enabled 字段查询
        console.log(`[ProtoChat Pricing] Updated pricing for ${allEnabledModels.size} enabled models`);
    }
}

export const pricingService = new PricingService();
