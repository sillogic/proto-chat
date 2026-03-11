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
     * @param model - Model ID (原始模型ID，如 'deepseek/deepseek-chat-v3.1')
     * @param provider - Provider ID (如 'openai', 'protochat' 等)
     * @param inputTokens - Number of input tokens (text + vision, combined by model runtime)
     * @param outputTextTokens - Number of text output tokens
     * @param outputImageTokens - Number of image output tokens (for image generation models)
     * @param isUserConfig - Whether user is using their own API key (if true, no charge)
     */
    async calculateCost(
        model: string,
        provider: string,
        inputTokens: number,
        outputTextTokens: number,
        outputImageTokens: number = 0,
        isUserConfig: boolean = false
    ) {
        // If user is using their own API key, don't charge
        if (isUserConfig) {
            console.info(`[Credit] User using own config for ${provider}, no charge`);
            return 0;
        }

        // 统一查询 modelPricings 表（包括 ProtoChat）
        const pricing = await this.db.query.modelPricings.findFirst({
            where: and(eq(modelPricings.model, model), eq(modelPricings.provider, provider)),
        });

        if (!pricing) {
            console.warn(`[Credit] No pricing found for ${provider}::${model}, no charge`);
            return 0;
        }

        // 直接使用预先计算好的用户价，无需运行时计算（性能优化）
        const userInputPrice = parseFloat(pricing.userInputPrice || '0');
        const userOutputPrice = parseFloat(pricing.userOutputPrice || '0');
        const userImageOutputPrice = parseFloat((pricing as any).userImageOutputPrice || '0');
        const perRequestPrice = parseFloat(pricing.perRequestPrice || '0');

        // Image output token cost (for image generation models like Gemini Nano Banana).
        // Uses a separate per-token rate sourced from OpenRouter /models/{id}/endpoints.
        const imageOutputCost = outputImageTokens > 0 && userImageOutputPrice > 0
            ? (outputImageTokens / 1_000_000) * userImageOutputPrice
            : 0;

        // Per-request fallback: only applies when ALL token counts are zero.
        // Used for providers that don't return usage data (Replicate, ComfyUI, etc.).
        const allTokensZero = inputTokens === 0 && outputTextTokens === 0 && outputImageTokens === 0;
        const perCost = allTokensZero ? perRequestPrice : 0;

        const cost = (inputTokens / 1_000_000) * userInputPrice
            + (outputTextTokens / 1_000_000) * userOutputPrice
            + imageOutputCost
            + perCost;

        const subProviderInfo = pricing.subProvider ? ` (via ${pricing.subProvider})` : '';
        console.info(`[Credit] Charging for ${provider}::${model}${subProviderInfo}, cost: ${cost.toFixed(4)} credits (in=${inputTokens} outText=${outputTextTokens} outImg=${outputImageTokens})`);

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
