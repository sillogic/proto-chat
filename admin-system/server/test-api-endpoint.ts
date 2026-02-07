/**
 * 测试 Dashboard API 端点
 * 用于验证接口返回正确的数据结构
 */

import dotenv from 'dotenv';
import { db } from './src/config/database';
import * as DashboardService from './src/services/dashboard-service';

dotenv.config({ override: true });

async function testDashboardAPI() {
  console.log('🧪 测试 Dashboard API 端点数据结构\n');
  console.log('='.repeat(60));

  try {
    // 模拟 /api/dashboard/enhanced 接口
    console.log('\n📡 GET /api/dashboard/enhanced?period=30d');
    console.log('-'.repeat(60));

    const period: '7d' | '30d' | '90d' = '30d';

    const [snapshot, periodMetrics, aiUsage, retentionCohorts] = await Promise.all([
      DashboardService.getSnapshotMetrics(),
      DashboardService.getPeriodMetrics(period),
      DashboardService.getAIUsageStats(period),
      DashboardService.getRetentionCohorts(30),
    ]);

    const response = {
      success: true,
      data: {
        snapshot,
        period: periodMetrics,
        aiUsage,
        retentionCohorts,
      },
    };

    console.log('\n✅ 接口返回数据结构:');
    console.log(JSON.stringify(response, null, 2));

    console.log('\n\n📊 数据说明:');
    console.log('-'.repeat(60));
    console.log('1. snapshot (存量指标) - 不受 period 影响:');
    console.log(`   - MRR: ¥${response.data.snapshot.mrr} (月度经常性收入)`);
    console.log(`   - ARR: ¥${response.data.snapshot.arr} (年度收入 = MRR × 12)`);
    console.log(`   - 总用户数: ${response.data.snapshot.totalUsers}`);
    console.log(`   - 活跃订阅数: ${response.data.snapshot.activeSubscriptions}`);

    console.log('\n2. period (流量指标) - 受 period 影响 (当前: 30d):');
    console.log(`   - 总收入: ¥${response.data.period.totalRevenue} (30天内)`);
    console.log(`   - 新增用户: ${response.data.period.newUsers} (30天内)`);
    console.log(`   - 新增订阅: ${response.data.period.newSubscriptions} (30天内)`);
    console.log(`   - API 调用: ${response.data.period.totalApiCalls} (30天内)`);
    console.log(`   - 收入趋势数据点: ${response.data.period.revenueTrend.length} 天`);

    console.log('\n3. aiUsage (AI 使用统计) - 受 period 影响 (当前: 30d):');
    console.log(`   - 供应商数量: ${response.data.aiUsage.byProvider.length}`);
    response.data.aiUsage.byProvider.forEach((p) => {
      console.log(`     * ${p.provider}: ${p.calls} 次调用 (${p.percentage.toFixed(1)}%)`);
    });

    console.log('\n4. retentionCohorts (留存率队列) - 固定显示最近 30 天:');
    console.log(`   - 队列数量: ${response.data.retentionCohorts.length}`);

    console.log('\n\n✅ API 端点测试完成!');
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testDashboardAPI()
  .then(() => {
    console.log('\n🎉 测试完成!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 测试过程出错:', error);
    process.exit(1);
  });
