import { TRPCError } from '@trpc/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import dayjs from 'dayjs';

import {
    embeddings,
    files,
    messages,
    subscriptionPlans,
    userBalances,
    userExtensions,
    userTransactions,
} from '@/database/schemas';
import { LobeChatDatabase } from '@/database/type';
import { CreditService } from '@/server/services/credit';

export class UserUsageService {
    private userId: string;
    private db: LobeChatDatabase;

    constructor(db: LobeChatDatabase, userId: string) {
        this.userId = userId;
        this.db = db;
    }

    /**
     * Check if user has enough tokens/credits to continue
     */
    async checkTokenLimit() {
        const creditService = new CreditService(this.db, this.userId);
        const hasEnough = await creditService.hasEnoughCredits(0);

        if (!hasEnough) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Insufficient credits. Please top up or upgrade your plan.',
            });
        }
    }

    /**
     * Check if user has exceeded file storage limit
     * @param incomingSize The size of the file(s) being uploaded in bytes
     */
    async checkFileStorageLimit(incomingSize: number = 0) {
        const userExt = await this.db.query.userExtensions.findFirst({
            where: eq(userExtensions.userId, this.userId),
        });

        let storageLimitMB = 512;

        if (userExt?.planId) {
            const plan = await this.db.query.subscriptionPlans.findFirst({
                where: eq(subscriptionPlans.id, userExt.planId),
            });
            if (plan) storageLimitMB = plan.storageLimit;
        } else {
            const plan = await this.db.query.subscriptionPlans.findFirst({
                where: eq(subscriptionPlans.slug, userExt?.currentPlan || 'free'),
            });
            if (plan) storageLimitMB = plan.storageLimit;
        }

        const storageLimitBytes = storageLimitMB * 1024 * 1024;
        const result = await this.db
            .select({
                totalSize: sql<number>`COALESCE(SUM(${files.size}), 0)`,
            })
            .from(files)
            .where(eq(files.userId, this.userId));

        const currentUsageBytes = Number(result[0]?.totalSize || 0);

        if (currentUsageBytes + incomingSize > storageLimitBytes) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Storage limit exceeded. Your plan limit is ${storageLimitMB}MB.`,
            });
        }
    }

    async checkVectorStorageLimit(incomingCount: number = 0) {
        const userExt = await this.db.query.userExtensions.findFirst({
            where: eq(userExtensions.userId, this.userId),
        });

        let vectorLimit = 0;

        if (userExt?.planId) {
            const plan = await this.db.query.subscriptionPlans.findFirst({
                where: eq(subscriptionPlans.id, userExt.planId),
            });
            if (plan) vectorLimit = plan.vectorLimit;
        }

        if (vectorLimit <= 0) return;

        const result = await this.db
            .select({
                count: sql<number>`COUNT(*)`,
            })
            .from(embeddings)
            .where(eq(embeddings.userId, this.userId));

        const currentCount = Number(result[0]?.count || 0);

        if (currentCount + incomingCount > vectorLimit) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Vector storage limit exceeded. Your plan limit is ${vectorLimit} chunks.`,
            });
        }
    }

    /**
     * Get account statistics including balance, limits and usage
     */
    async getAccountStatistics(mo?: string) {
        const balanceResult = await this.db.query.userBalances.findFirst({
            where: eq(userBalances.userId, this.userId),
        });

        const userExt = await this.db.query.userExtensions.findFirst({
            where: eq(userExtensions.userId, this.userId),
        });

        const planId = userExt?.planId;
        const currentPlan = userExt?.currentPlan || 'free';

        const plan = await this.db.query.subscriptionPlans.findFirst({
            where: planId ? eq(subscriptionPlans.id, planId) : eq(subscriptionPlans.slug, currentPlan),
        });

        let startAtDate: Date;
        let endAtDate: Date;

        if (mo) {
            startAtDate = dayjs(mo, 'YYYY-MM').startOf('month').toDate();
            endAtDate = dayjs(mo, 'YYYY-MM').endOf('month').toDate();
        } else {
            startAtDate = dayjs().startOf('month').toDate();
            endAtDate = dayjs().endOf('month').toDate();
        }

        const consumptionResult = await this.db
            .select({
                total: sql<number>`ABS(SUM(${userTransactions.amount}))`,
            })
            .from(userTransactions)
            .where(
                and(
                    eq(userTransactions.userId, this.userId),
                    eq(userTransactions.type, 'CONSUMPTION'),
                    sql`${userTransactions.createdAt} >= ${startAtDate.toISOString()}`,
                    sql`${userTransactions.createdAt} <= ${endAtDate.toISOString()}`,
                ),
            );

        const totalConsumed = Number(consumptionResult[0]?.total || 0);

        const storageResult = await this.db
            .select({
                totalSize: sql<number>`COALESCE(SUM(${files.size}), 0)`,
            })
            .from(files)
            .where(eq(files.userId, this.userId));
        const storageUsageBytes = Number(storageResult[0]?.totalSize || 0);

        const vectorResult = await this.db
            .select({
                count: sql<number>`COUNT(*)`,
            })
            .from(embeddings)
            .where(eq(embeddings.userId, this.userId));
        const vectorUsageCount = Number(vectorResult[0]?.count || 0);

        return {
            balance: {
                current: Number(balanceResult?.balance || 0),
                currentPlan: plan?.name || 'Free Trial',
                limit: Number(plan?.credits || 0),
                planSlug: plan?.slug || 'free',
                totalConsumed,
            },
            resetCountdown: {
                nextResetDate: userExt?.planExpiresAt ? dayjs(userExt.planExpiresAt).format('YYYY-MM-DD') : '-',
            },
            storage: {
                limitMB: plan?.storageLimit || 512,
                totalSizeMB: Number((storageUsageBytes / 1024 / 1024).toFixed(2)),
            },
            vectors: {
                count: vectorUsageCount,
                limit: plan?.vectorLimit || 0,
            },
        };
    }

    /**
     * Get paginated transaction history
     */
    async getTransactions(limit: number = 20, offset: number = 0, mo?: string) {
        let whereClause = eq(userTransactions.userId, this.userId);

        if (mo) {
            const startAt = dayjs(mo, 'YYYY-MM').startOf('month').toDate();
            const endAt = dayjs(mo, 'YYYY-MM').endOf('month').toDate();
            whereClause = and(
                whereClause,
                sql`${userTransactions.createdAt} >= ${startAt.toISOString()}`,
                sql`${userTransactions.createdAt} <= ${endAt.toISOString()}`,
            ) as any;
        }

        const records = await this.db.query.userTransactions.findMany({
            limit,
            offset,
            orderBy: [desc(userTransactions.createdAt)],
            where: whereClause,
        });

        const totalStats = await this.db
            .select({ count: sql<number>`count(*)` })
            .from(userTransactions)
            .where(whereClause);

        return {
            list: records,
            total: Number(totalStats[0]?.count || 0),
        };
    }

    /**
     * Get paginated usage consumption details
     */
    async getUsageDetails(limit: number = 20, offset: number = 0, mo?: string) {
        let whereClause = and(
            eq(userTransactions.userId, this.userId),
            eq(userTransactions.type, 'CONSUMPTION'),
        );

        if (mo) {
            const startAt = dayjs(mo, 'YYYY-MM').startOf('month').toDate();
            const endAt = dayjs(mo, 'YYYY-MM').endOf('month').toDate();
            whereClause = and(
                whereClause,
                sql`${userTransactions.createdAt} >= ${startAt.toISOString()}`,
                sql`${userTransactions.createdAt} <= ${endAt.toISOString()}`,
            );
        }

        const records = await this.db
            .select({
                message: messages,
                transaction: userTransactions,
            })
            .from(userTransactions)
            .leftJoin(messages, eq(userTransactions.refId, messages.id))
            .where(whereClause)
            .limit(limit)
            .offset(offset)
            .orderBy(desc(userTransactions.createdAt));

        const totalStats = await this.db
            .select({ count: sql<number>`count(*)` })
            .from(userTransactions)
            .where(whereClause);

        return {
            list: records.map(({ transaction: r, message: m }) => {
                const metadata = (r.metadata as any) || {};
                const msgMetadata = (m?.metadata as any) || {};

                // Fallback to message table if metadata is missing in transaction
                const model = metadata.model || m?.model || '-';
                const provider = metadata.provider || m?.provider || '-';
                const inputTokens = metadata.totalInputTokens || msgMetadata.totalInputTokens || 0;
                const outputTokens = metadata.totalOutputTokens || msgMetadata.totalOutputTokens || 0;
                const duration = metadata.duration || msgMetadata.duration || 0;

                // Determine usage type (text, embedding, image, etc.)
                let usageType = 'chat';
                // Check metadata.type first to distinguish between chat/image/embedding
                if (metadata.type) {
                    usageType = metadata.type.toLowerCase();
                } else if (m) {
                    // If associated with a message, it's chat
                    usageType = 'chat';
                } else if (r.refId && r.refId.startsWith('gen_')) {
                    // If refId starts with 'gen_', it's image generation
                    usageType = 'image';
                } else if (r.category) {
                    // Fallback to category
                    usageType = r.category.toLowerCase();
                }

                return {
                    ...r,
                    credits: Math.abs(Number(r.amount)),
                    duration,
                    model,
                    provider,
                    totalInputTokens: inputTokens,
                    totalOutputTokens: outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    usageType,
                };
            }),
            total: Number(totalStats[0]?.count || 0),
        };
    }
}
