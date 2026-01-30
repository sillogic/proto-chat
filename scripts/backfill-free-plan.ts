
import { db } from '../admin-system/server/src/config/database';
import { userExtensions, userSubscriptionHistory } from '../admin-system/server/src/db/user-extensions-schema';
import { subscriptionPlans } from '../admin-system/server/src/db/subscription-schema';
import { userBalances } from '../admin-system/server/src/db/credit-schema';
import { eq, isNull, and } from 'drizzle-orm';

async function backfill() {
    console.log('🚀 Starting backfill for existing users to Free Plan...');

    // 1. 获取 Free 计划详情
    const freePlans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, 'plan_free')).limit(1);
    const freePlan = freePlans[0];

    if (!freePlan) {
        console.error('❌ Error: Plan with id "plan_free" not found!');
        process.exit(1);
    }

    // 2. 找到所有没有 planId 的用户
    const targetUsers = await db.select().from(userExtensions).where(isNull(userExtensions.planId));
    console.log(`🔍 Found ${targetUsers.length} users without plan_id.`);

    for (const user of targetUsers) {
        try {
            await db.transaction(async (tx) => {
                const now = new Date();

                // A. 更新用户扩展表
                await tx.update(userExtensions)
                    .set({
                        planId: freePlan.id,
                        currentPlan: freePlan.slug,
                        updatedAt: now
                    })
                    .where(eq(userExtensions.userId, user.userId));

                // B. 插入订阅历史
                await tx.insert(userSubscriptionHistory)
                    .values({
                        userId: user.userId,
                        planId: freePlan.id,
                        planName: freePlan.name,
                        planType: freePlan.type,
                        slug: freePlan.slug,
                        features: freePlan.features || {},
                        price: freePlan.monthlyPrice || 0,
                        isActive: true,
                        startedAt: now,
                        createdAt: now
                    })
                    .onConflictDoNothing(); // 防止重复运行冲突

                // C. 初始化积分
                await tx.insert(userBalances)
                    .values({
                        userId: user.userId,
                        balance: freePlan.credits,
                        updatedAt: now
                    })
                    .onConflictDoUpdate({
                        set: {
                            balance: freePlan.credits,
                            updatedAt: now
                        },
                        target: userBalances.userId
                    });

                console.log(`✅ User ${user.userId} linked to Free Plan.`);
            });
        } catch (err) {
            console.error(`❌ Failed to process user ${user.userId}:`, err);
        }
    }

    console.log('✨ Backfill completed!');
    process.exit(0);
}

backfill();
