import { db } from '../config/database';
import { modelPricings, NewModelPricing } from '../db/subscription-schema';
import { aiProviders, aiModels } from '../db/ai-providers-schema';
import { protochatProviders, protochatSettings, protochatModels, protochatModelPricing } from '../db/protochat-schema';
import { eq, desc, and, or, isNull, like } from 'drizzle-orm';
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

        // 2. Clear existing token-based pricings, and auto-synced per-request image entries.
        // Manually-set per-request entries (memo NOT starting with '[auto-image]') are preserved.
        await db.delete(modelPricings).where(
            or(
                eq(modelPricings.perRequestPrice, '0'),
                isNull(modelPricings.perRequestPrice),
                like(modelPricings.memo, '[auto-image]%'),
            ),
        );

        // Use a map to deduplicate (model, provider, subProvider) tuples
        const pricingMap = new Map<string, NewModelPricing>();

        // 3. Always sync ProtoChat pricing from its own tables (protochatProviders/Models),
        // independent of whether 'protochat' appears in aiProviders.
        await this.syncProtoChatPricing(pricingMap, multiplier);

        // 4. Fetch enabled global non-ProtoChat providers
        const enabledProviders = await db
            .select()
            .from(aiProviders)
            .where(and(eq(aiProviders.enabled, true), eq(aiProviders.isGlobal, true)));

        for (const provider of enabledProviders) {
            // Skip ProtoChat — already handled above
            if (provider.id === 'protochat') continue;

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

        // Use individual upserts to handle existing manual entries that survived the delete step.
        // The actual DB unique constraint is on (model, provider), so we target those columns.
        for (const pricing of newPricings) {
            await db.insert(modelPricings)
                .values(pricing as any)
                .onConflictDoUpdate({
                    target: [modelPricings.model, modelPricings.provider],
                    set: {
                        inputPrice: (pricing.inputPrice || '0') as string,
                        outputPrice: (pricing.outputPrice || '0') as string,
                        userInputPrice: (pricing.userInputPrice || '0') as string,
                        userOutputPrice: (pricing.userOutputPrice || '0') as string,
                        perRequestPrice: (pricing.perRequestPrice || '0') as string,
                        subProvider: (pricing.subProvider || null) as string | null,
                        memo: pricing.memo as string,
                        updatedAt: new Date(),
                    } as any,
                });
        }

        console.log(`[Pricing Sync] Created/updated ${newPricings.length} pricing entries`);
        return { count: newPricings.length };
    }

    // Sync ProtoChat pricing from sub-providers
    private async syncProtoChatPricing(pricingMap: Map<string, NewModelPricing>, multiplier: number) {
        // Fetch all enabled ProtoChat sub-providers
        const subProviders = await db
            .select()
            .from(protochatProviders)
            .where(eq(protochatProviders.enabled, true));

        const allEnabledModels = new Set<string>();

        for (const subProvider of subProviders) {
            const subProviderModels = await db
                .select()
                .from(protochatModels)
                .where(and(
                    eq(protochatModels.originalProvider, subProvider.id),
                    eq(protochatModels.enabled, true)
                ));

            console.log(`[ProtoChat Sync] Found ${subProviderModels.length} enabled models for sub-provider ${subProvider.id}`);

            for (const model of subProviderModels) {
                allEnabledModels.add(model.id);

                // ONE entry per model — merging token pricing + per-request image pricing.
                // The DB unique constraint is on (model, provider), so we cannot have separate
                // token and image entries for the same model.
                const entryKey = `${model.id}-protochat-${subProvider.id}`;
                if (pricingMap.has(entryKey)) continue;

                // --- Token pricing (from protochatModelPricing) ---
                let costInputPrice = 0;
                let costOutputPrice = 0;

                const pricingResults = await db
                    .select()
                    .from(protochatModelPricing)
                    .where(eq(protochatModelPricing.modelId, model.id))
                    .limit(1);

                if (pricingResults.length === 0) {
                    console.warn(`[ProtoChat Sync] Model ${model.id} has no pricing in protochatModelPricing table`);
                } else {
                    const pricing = pricingResults[0];
                    costInputPrice = Math.ceil(parseFloat(pricing.costInputPrice) * SYNC_MULTIPLIER * 100) / 100;
                    costOutputPrice = Math.ceil(parseFloat(pricing.costOutputPrice) * SYNC_MULTIPLIER * 100) / 100;
                }

                // --- Per-request image pricing ---
                const capabilities = model.capabilities as any;
                const settings = model.settings as any;
                let perRequestPriceCredits = 0;

                if (capabilities?.imageOutput) {
                    // Primary: OpenRouter's pricing.image (USD per image)
                    let imagePricePerUnit = parseFloat(settings?.extraPricing?.imagePrice || '0');

                    // Fallback: token-billed image models (e.g. Gemini Nano Banana) have
                    // pricing.image = 0 from OpenRouter. Use model-bank's approximatePricePerImage.
                    if (imagePricePerUnit === 0) {
                        // model.id format: protochat::{alias}::{cleanModelId}
                        const cleanModelId = model.id.split('::').slice(2).join('::');
                        const bankEntry = (LOBE_DEFAULT_MODEL_LIST as any[]).find(
                            (m: any) =>
                                (m.id === cleanModelId || m.id === `${cleanModelId}:image`) &&
                                m.pricing?.approximatePricePerImage > 0,
                        );
                        if (bankEntry?.pricing?.approximatePricePerImage) {
                            imagePricePerUnit = bankEntry.pricing.approximatePricePerImage;
                            console.log(`[ProtoChat Sync] Using model-bank approximatePricePerImage=${imagePricePerUnit} for ${model.id}`);
                        }
                    }

                    if (imagePricePerUnit > 0) {
                        const costImagePrice = Math.ceil(imagePricePerUnit * SYNC_MULTIPLIER * 100) / 100;
                        perRequestPriceCredits = Math.ceil(costImagePrice * multiplier * 100) / 100;
                    }
                }

                // Skip models with no pricing at all
                if (costInputPrice === 0 && costOutputPrice === 0 && perRequestPriceCredits === 0) continue;

                const userInputPrice = Math.ceil(costInputPrice * multiplier * 100) / 100;
                const userOutputPrice = Math.ceil(costOutputPrice * multiplier * 100) / 100;
                const isImageModel = perRequestPriceCredits > 0;

                pricingMap.set(entryKey, {
                    id: idGenerator('mp'),
                    model: model.id,
                    provider: 'protochat',
                    subProvider: subProvider.id,
                    inputPrice: costInputPrice.toFixed(2),
                    outputPrice: costOutputPrice.toFixed(2),
                    userInputPrice: userInputPrice.toFixed(2),
                    userOutputPrice: userOutputPrice.toFixed(2),
                    perRequestPrice: isImageModel ? perRequestPriceCredits.toFixed(2) : '0',
                    // [auto-image] prefix ensures this entry is deleted on the next sync.
                    // Non-imageOutput entries use the default token-based deletion (perRequestPrice='0').
                    memo: isImageModel
                        ? `[auto-image] ProtoChat (${subProvider.name || subProvider.id})`
                        : `ProtoChat (${subProvider.name || subProvider.id})`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any);
            }
        }

        console.log(`[ProtoChat Pricing] Updated pricing for ${allEnabledModels.size} enabled models`);
    }
}

export const pricingService = new PricingService();
