import { LobeChatDatabase } from '@/database/type';
import { userBalances, userTransactions, modelPricings } from '@/database/schemas';
import { eq, and } from 'drizzle-orm';
import { idGenerator } from '@/database/utils/idGenerator';

export class CreditService {
    private userId: string;
    private db: LobeChatDatabase;

    constructor(db: LobeChatDatabase, userId: string) {
        this.userId = userId;
        this.db = db;
    }

    /**
     * Calculate credits needed for a chat completion
     */
    async calculateCost(model: string, provider: string, inputTokens: number, outputTokens: number) {
        const pricing = await this.db.query.modelPricings.findFirst({
            where: and(eq(modelPricings.model, model), eq(modelPricings.provider, provider)),
        });

        if (!pricing) {
            // Default pricing if not found? Or return 0?
            // For now, return 0 or a very high default to be safe? 
            // User wants configurable pricing, so we should probably warn or use a default.
            return 0;
        }

        const inputPrice = parseFloat(pricing.inputPrice || '0');
        const outputPrice = parseFloat(pricing.outputPrice || '0');
        const perRequestPrice = parseFloat(pricing.perRequestPrice || '0');

        // Price is in credits per 1,000,000 tokens
        const cost = (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice + perRequestPrice;

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
                id: idGenerator('tx'),
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
