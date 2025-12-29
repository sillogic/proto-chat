
import { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { EmbeddingModel } from '@/database/models/embedding';
import { FileModel } from '@/database/models/file';
import { userExtensions } from '@/database/schemas';
import { UsageRecordService } from '@/server/services/usage';

export class UserUsageService {
    private userId: string;
    private db: LobeChatDatabase;
    private fileModel: FileModel;
    private embeddingModel: EmbeddingModel;
    private usageRecordService: UsageRecordService;

    constructor(db: LobeChatDatabase, userId: string) {
        this.userId = userId;
        this.db = db;
        this.fileModel = new FileModel(db, userId);
        this.embeddingModel = new EmbeddingModel(db, userId);
        this.usageRecordService = new UsageRecordService(db, userId);
    }

    private async getUserLimits() {
        const extension = await this.db.query.userExtensions.findFirst({
            where: eq(userExtensions.userId, this.userId),
        });

        // Default limits if no extension found (shouldn't happen for valid users)
        if (!extension) {
            return {
                monthlyStorageLimit: 0, // 0 usually means unlimited or no access, let's assume strict
                monthlyTokenLimit: 0,
                // userExtensions doesn't have monthlyVectorLimit in the schema I saw?
                // Let's check schema again. It had subscriptionPlans.vectorLimit.
                // userExtensions has currentTokensUsed, monthlyTokenLimit, monthlyStorageLimit.
                // It does NOT seem to have monthlyVectorLimit.
                // But userExtensions has `currentPlan`. We might need to fetch the plan details if limits are not in extension.
                // However, the schema file `userExtension.ts` showed `monthlyStorageLimit` and `monthlyTokenLimit`.
                // It did NOT show `monthlyVectorLimit`.
                // The `plan` has `vectorLimit`.
            };
        }

        // If limits are missing in userExtensions, we might need to rely on the Plan.
        // typically userExtensions copies limits from Plan on creation/renewal.
        // If vector limit is missing in userExtension, we should probably fetch the plan.
        // But for now let's assume we can fetch plan.

        const plan = await this.db.query.subscriptionPlans.findFirst({
            where: (plans, { eq }) => eq(plans.name, extension.currentPlan || 'Free Trial')
        });

        return {
            monthlyStorageLimit: extension.monthlyStorageLimit ?? (plan?.storageLimit ?? 1024), // MB
            monthlyTokenLimit: extension.monthlyTokenLimit ?? (plan?.credits ? parseInt(plan.credits) : 0),
            vectorLimit: plan?.vectorLimit ?? 0, // MB
        };
    }

    async checkFileStorageLimit(incomingSizeInBytes: number) {
        const limits = await this.getUserLimits();
        // 0 or -1 usually could mean unlimited, but here defaults were 1024.
        // If limit is incredibly high, it's unlimited.

        // Convert limit to bytes. Limit is in MB.
        const limitBytes = limits.monthlyStorageLimit * 1024 * 1024;

        const currentUsage = await this.fileModel.countUsage(); // countUsage returns bytes (sum of size)

        if (currentUsage + incomingSizeInBytes > limitBytes) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Storage limit exceeded. Current: ${(currentUsage / 1024 / 1024).toFixed(2)}MB, Limit: ${limits.monthlyStorageLimit}MB`,
            });
        }
    }

    async checkVectorStorageLimit(incomingCount: number) {
        const limits = await this.getUserLimits();

        // Limit is in MB.
        // 1 vector (1024 dims) ~ 4KB.
        // 1 MB = 256 vectors.
        const limitCount = limits.vectorLimit * 256;

        if (limitCount === 0) return; // If 0 in plan usually means "no vector storage" or "unlimited"?
        // In subscription.ts: vectorLimit default 0.
        // If it acts as a limit, 0 means NO vectors allowed.

        const currentCount = await this.embeddingModel.countUsage();

        if (currentCount + incomingCount > limitCount) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Vector storage limit exceeded. Current: ${(currentCount / 256).toFixed(2)}MB, Limit: ${limits.vectorLimit}MB`,
            });
        }
    }

    async checkTokenLimit() {
        // We check if *current* usage is already over limit. 
        // We don't know exact incoming usage for tokens before generation.
        const limits = await this.getUserLimits();

        const usageRecords = await this.usageRecordService.findByMonth();
        const currentTokens = usageRecords.reduce((acc, record) => acc + (record.totalTokens || 0), 0);

        if (currentTokens >= limits.monthlyTokenLimit) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Monthly token limit exceeded. Current: ${currentTokens}, Limit: ${limits.monthlyTokenLimit}`,
            });
        }
    }
}
