import { and,eq } from 'drizzle-orm';

import { modelPricings,userBalances, userTransactions } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { idGenerator } from '@/database/utils/idGenerator';

export class CreditService {
    private userId: string;
    private db: LobeChatDatabase;

    constructor(db: LobeChatDatabase, userId: string) {
        this.userId = userId;
        this.db = db;
    }

    /**
     * Calculate credits needed for a model call.
     *
     * 统一的计费逻辑：所有供应商（包括 ProtoChat）都从 modelPricings 表查询用户价，
     * 用户价已经预先计算好（成本价 × 系数），直接使用，无需运行时计算，提升性能
     *
     * Cache billing: if the model supports cache and cachedInputTokens > 0, those tokens
     * are billed at the cheaper cacheReadPrice instead of the regular inputPrice.
     *
     * @param model - Model ID (原始模型ID，如 'deepseek/deepseek-chat-v3.1')
     * @param provider - Provider ID (如 'openai', 'protochat' 等)
     * @param inputTokens - Number of input tokens (total, including cached)
     * @param outputTextTokens - Number of text output tokens
     * @param outputImageTokens - Number of image output tokens (for image generation models)
     * @param isUserConfig - Whether user is using their own API key (if true, no charge)
     * @param cachedInputTokens - Number of cache-hit input tokens (billed at cacheReadPrice)
     */
    async calculateCost(
        model: string,
        provider: string,
        inputTokens: number,
        outputTextTokens: number,
        outputImageTokens: number = 0,
        isUserConfig: boolean = false,
        cachedInputTokens: number = 0
    ) {
        // If user is using their own API key, don't charge
        if (isUserConfig) {
            return 0;
        }

        // 统一查询 modelPricings 表（包括 ProtoChat）
        const pricing = await this.db.query.modelPricings.findFirst({
            where: and(eq(modelPricings.model, model), eq(modelPricings.provider, provider)),
        });

        if (!pricing) {
            return 0;
        }

        // 直接使用预先计算好的用户价，无需运行时计算（性能优化）
        const userInputPrice = parseFloat(pricing.userInputPrice || '0');
        const userOutputPrice = parseFloat(pricing.userOutputPrice || '0');
        const userImageOutputPrice = parseFloat((pricing as any).userImageOutputPrice || '0');
        const userCacheReadPrice = parseFloat((pricing as any).userCacheReadPrice || '0');
        const perRequestPrice = parseFloat(pricing.perRequestPrice || '0');

        // Cache-aware input billing:
        // - Cache-hit tokens billed at cacheReadPrice (cheaper), fallback to inputPrice if no cache pricing
        // - Cache-miss tokens always billed at regular inputPrice
        const safeCachedTokens = Math.min(cachedInputTokens, inputTokens);
        const cacheMissTokens = inputTokens - safeCachedTokens;
        const inputCost = (cacheMissTokens / 1_000_000) * userInputPrice
            + (userCacheReadPrice > 0
                ? (safeCachedTokens / 1_000_000) * userCacheReadPrice
                : (safeCachedTokens / 1_000_000) * userInputPrice);

        // Image output token cost (for image generation models like Gemini Nano Banana).
        // Uses a separate per-token rate sourced from OpenRouter /models/{id}/endpoints.
        const imageOutputCost = outputImageTokens > 0 && userImageOutputPrice > 0
            ? (outputImageTokens / 1_000_000) * userImageOutputPrice
            : 0;

        // Per-request fallback: only applies when ALL token counts are zero.
        // Used for providers that don't return usage data (Replicate, ComfyUI, etc.).
        const allTokensZero = inputTokens === 0 && outputTextTokens === 0 && outputImageTokens === 0;
        const perCost = allTokensZero ? perRequestPrice : 0;

        const cost = inputCost
            + (outputTextTokens / 1_000_000) * userOutputPrice
            + imageOutputCost
            + perCost;

        return cost;
    }

    /**
     * Deduct credits from user balance
     */
    async deductCredits(amount: number, description: string, refId?: string, metadata?: any) {
        if (amount <= 0) return;

        return this.db.transaction(async (tx) => {
            const balance = await tx.query.userBalances.findFirst({
                where: eq(userBalances.userId, this.userId),
            });

            if (!balance) {
                throw new Error('User balance not found');
            }

            if (!balance.isUnlimited && parseFloat(balance.balance) < amount) {
                throw new Error('Insufficient credits');
            }

            const newBalance = parseFloat(balance.balance) - amount;

            await tx
                .update(userBalances)
                .set({
                    balance: newBalance.toFixed(4),
                    updatedAt: new Date(),
                })
                .where(eq(userBalances.userId, this.userId));

            await tx.insert(userTransactions).values({
                amount: (-amount).toFixed(4),
                balanceAfter: newBalance.toFixed(4),
                category: 'CONSUMPTION',
                description,
                id: idGenerator('userTransactions'),
                metadata,
                refId,
                type: 'CONSUMPTION',
                userId: this.userId,
            });

            return newBalance;
        });
    }

    /**
     * Record usage without deducting credits.
     * Used for system-initiated model calls (e.g. title generation) where we want
     * admin visibility but do not charge the user.
     */
    async recordUsage(description: string, metadata?: Record<string, unknown>): Promise<void> {
        const balance = await this.db.query.userBalances.findFirst({
            where: eq(userBalances.userId, this.userId),
        });
        const currentBalance = parseFloat(balance?.balance || '0');

        await this.db.insert(userTransactions).values({
            amount: '0.0000',
            balanceAfter: currentBalance.toFixed(4),
            category: 'CONSUMPTION',
            description,
            metadata,
            type: 'CONSUMPTION',
            userId: this.userId,
        });
    }

    /**
     * Calculate the upstream cost (what we pay) for a model call.
     * Uses inputPrice/outputPrice from model_pricings (not the user-facing markup price).
     * Returns 0 if no pricing found.
     */
    async calculateCostPrice(
        model: string,
        provider: string,
        inputTokens: number,
        outputTokens: number,
        cachedInputTokens: number = 0,
    ): Promise<number> {
        const pricing = await this.db.query.modelPricings.findFirst({
            where: and(eq(modelPricings.model, model), eq(modelPricings.provider, provider)),
        });
        if (!pricing) return 0;

        const inputPrice = parseFloat(pricing.inputPrice || '0');
        const outputPrice = parseFloat(pricing.outputPrice || '0');
        const cacheReadPrice = parseFloat((pricing as any).cacheReadPrice || '0');

        const safeCachedTokens = Math.min(cachedInputTokens, inputTokens);
        const cacheMissTokens = inputTokens - safeCachedTokens;
        const inputCost = (cacheMissTokens / 1_000_000) * inputPrice
            + (cacheReadPrice > 0
                ? (safeCachedTokens / 1_000_000) * cacheReadPrice
                : (safeCachedTokens / 1_000_000) * inputPrice);

        return inputCost + (outputTokens / 1_000_000) * outputPrice;
    }

    /**
     * Check if user has enough credits
     */
    async hasEnoughCredits(estimatedAmount: number = 0) {
        const balance = await this.db.query.userBalances.findFirst({
            where: eq(userBalances.userId, this.userId),
        });

        if (!balance) return false;
        if (balance.isUnlimited) return true;

        const currentBalance = parseFloat(balance.balance);
        if (estimatedAmount === 0) return currentBalance > 0;

        return currentBalance >= estimatedAmount;
    }
}
