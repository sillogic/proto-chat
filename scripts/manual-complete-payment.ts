/**
 * Manual Payment Completion Script
 *
 * 用于本地开发时手动完成支付订单（模拟支付宝回调）
 *
 * 使用方法：
 * bun run scripts/manual-complete-payment.ts <订单号>
 *
 * 例如：
 * bun run scripts/manual-complete-payment.ts PC20260130141216170611
 */

import {
  paymentOrders,
  serverDB,
  subscriptionPlans,
  userBalances,
  userExtensions,
  userSubscriptionHistory,
  userTransactions,
} from '@lobechat/database';
import { eq } from 'drizzle-orm';

const orderNo = process.argv[2];

if (!orderNo) {
  console.error('❌ 请提供订单号');
  console.error('使用方法: bun run scripts/manual-complete-payment.ts <订单号>');
  process.exit(1);
}

async function completePayment() {
  console.log(`\n🔍 查询订单: ${orderNo}\n`);

  // 1. 查询订单
  const orderResult = await serverDB
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.orderNo, orderNo))
    .limit(1);

  if (!orderResult || orderResult.length === 0) {
    console.error('❌ 订单不存在');
    process.exit(1);
  }

  const order = orderResult[0];

  console.log('订单信息：');
  console.log('- 订单号:', order.orderNo);
  console.log('- 用户ID:', order.userId);
  console.log('- 方案ID:', order.planId);
  console.log('- 金额:', order.amount / 100, '元');
  console.log('- 状态:', order.status);
  console.log('- 支付方式:', order.payChannel);
  console.log('');

  // 2. 检查订单状态
  if (order.status === 'paid') {
    console.log('✅ 订单已支付，无需处理');
    process.exit(0);
  }

  if (order.status !== 'pending') {
    console.error(`❌ 订单状态异常: ${order.status}`);
    process.exit(1);
  }

  // 3. 查询方案信息
  const planResult = await serverDB
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, order.planId))
    .limit(1);

  if (!planResult || planResult.length === 0) {
    console.error('❌ 方案不存在');
    process.exit(1);
  }

  const plan = planResult[0];

  console.log('方案信息：');
  console.log('- 名称:', plan.name);
  console.log('- Slug:', plan.slug);
  console.log('- 积分:', plan.credits);
  console.log('');

  // 4. 计算日期
  const now = new Date();
  const expiresAt = new Date(now);
  if (order.planInterval === 'year') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const nextCreditGrantAt = new Date(now);
  nextCreditGrantAt.setMonth(nextCreditGrantAt.getMonth() + 1);

  console.log('📅 日期计算：');
  console.log('- 当前时间:', now.toISOString());
  console.log('- 过期时间:', expiresAt.toISOString());
  console.log('- 下次积分发放:', nextCreditGrantAt.toISOString());
  console.log('');

  // 5. 执行事务
  console.log('💾 开始更新数据库...\n');

  await serverDB.transaction(async (tx: typeof serverDB) => {
    // 5a. 更新订单状态
    await tx
      .update(paymentOrders)
      .set({
        status: 'paid',
        paidAt: now,
        channelOrderNo: 'MANUAL_' + Date.now(),
        updatedAt: now,
      })
      .where(eq(paymentOrders.orderNo, orderNo));

    console.log('✅ 订单状态已更新为 paid');

    // 5b. 更新或创建用户扩展信息
    const existingUserExt = await tx
      .select()
      .from(userExtensions)
      .where(eq(userExtensions.userId, order.userId))
      .limit(1);

    if (existingUserExt && existingUserExt.length > 0) {
      await tx
        .update(userExtensions)
        .set({
          currentPlan: plan.slug,
          planId: plan.id,
          planExpiresAt: expiresAt,
          billingInterval: order.planInterval,
          nextCreditGrantAt,
          updatedAt: now,
        })
        .where(eq(userExtensions.userId, order.userId));

      console.log('✅ 用户订阅信息已更新');
    } else {
      await tx.insert(userExtensions).values({
        id: crypto.randomUUID(),
        userId: order.userId,
        currentPlan: plan.slug,
        planId: plan.id,
        planExpiresAt: expiresAt,
        billingInterval: order.planInterval,
        nextCreditGrantAt,
        createdAt: now,
        updatedAt: now,
      });

      console.log('✅ 用户订阅信息已创建');
    }

    // 5c. 写入订阅历史
    const price = order.planInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
    await tx.insert(userSubscriptionHistory).values({
      id: crypto.randomUUID(),
      userId: order.userId,
      planId: plan.id,
      slug: plan.slug,
      planName: plan.name,
      planType: plan.type,
      status: 'active',
      price: price || order.amount,
      subscriptionType: 'recurring',
      orderNo,
      startedAt: now,
      endedAt: expiresAt,
      createdAt: now,
    });

    console.log('✅ 订阅历史已写入');

    // 5d. 发放积分
    const credits = parseInt(plan.credits, 10);
    const existingBalance = await tx
      .select()
      .from(userBalances)
      .where(eq(userBalances.userId, order.userId))
      .limit(1);

    if (existingBalance && existingBalance.length > 0) {
      await tx
        .update(userBalances)
        .set({
          balance: String(credits),
          updatedAt: now,
        })
        .where(eq(userBalances.userId, order.userId));

      console.log(`✅ 积分余额已重置为 ${credits}`);
    } else {
      await tx.insert(userBalances).values({
        userId: order.userId,
        balance: String(credits),
        createdAt: now,
        updatedAt: now,
      });

      console.log(`✅ 积分账户已创建，余额 ${credits}`);
    }

    // 5e. 写入交易记录
    await tx.insert(userTransactions).values({
      id: crypto.randomUUID(),
      userId: order.userId,
      type: 'SUBSCRIPTION_GRANT',
      category: 'SUBSCRIPTION_PURCHASE',
      amount: String(credits),
      balanceAfter: String(credits),
      metadata: {
        orderNo,
        planId: plan.id,
        planSlug: plan.slug,
        billingInterval: order.planInterval,
        manual: true, // 标记为手动完成
      },
      createdAt: now,
    });

    console.log('✅ 交易记录已写入');
  });

  console.log('\n🎉 支付完成！');
  console.log('\n📊 结果摘要：');
  console.log('- 订单号:', orderNo);
  console.log('- 方案:', plan.name, `(${plan.slug})`);
  console.log('- 周期:', order.planInterval === 'year' ? '年付' : '月付');
  console.log('- 积分:', plan.credits);
  console.log('- 有效期至:', expiresAt.toLocaleDateString('zh-CN'));
  console.log('');
  console.log('💡 提示: 刷新订阅页面即可看到更新后的状态');
  console.log('');
}

completePayment().catch((error) => {
  console.error('\n❌ 错误:', error.message);
  process.exit(1);
});
