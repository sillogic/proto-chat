/**
 * Dashboard 接口测试脚本
 * 用于测试所有 Dashboard 相关接口是否正常返回数据
 */

import dotenv from 'dotenv';
import { db } from './src/config/database';
import * as DashboardService from './src/services/dashboard-service';

dotenv.config({ override: true });

async function testDashboard() {
  console.log('🚀 开始测试 Dashboard 接口...\n');

  try {
    // 测试 1: 存量指标
    console.log('📊 测试 1: 获取存量指标 (Snapshot Metrics)');
    console.log('='.repeat(50));
    const snapshot = await DashboardService.getSnapshotMetrics();
    console.log('✅ 存量指标获取成功:');
    console.log(`   - 总用户数: ${snapshot.totalUsers}`);
    console.log(`   - 活跃用户数 (7天): ${snapshot.activeUsers}`);
    console.log(`   - 今日活跃用户: ${snapshot.todayActiveUsers}`);
    console.log(`   - 活跃订阅数: ${snapshot.activeSubscriptions}`);
    console.log(`   - MRR: ¥${snapshot.mrr.toFixed(2)}`);
    console.log(`   - ARR: ¥${snapshot.arr.toFixed(2)}`);
    console.log(`   - 套餐分布:`, snapshot.planDistribution);
    console.log('');

    // 测试 2: 流量指标 (7d)
    console.log('📈 测试 2: 获取流量指标 (Period Metrics - 7d)');
    console.log('='.repeat(50));
    const period7d = await DashboardService.getPeriodMetrics('7d');
    console.log('✅ 7天流量指标获取成功:');
    console.log(`   - 总收入: ¥${period7d.totalRevenue.toFixed(2)}`);
    console.log(`   - 新增订阅: ${period7d.newSubscriptions}`);
    console.log(`   - 流失订阅: ${period7d.churnedSubscriptions}`);
    console.log(`   - 新增用户: ${period7d.newUsers}`);
    console.log(`   - API 调用数: ${period7d.totalApiCalls}`);
    console.log(`   - Token 总数: ${period7d.totalTokens}`);
    console.log(`   - 收入趋势数据点: ${period7d.revenueTrend.length} 天`);
    console.log(`   - 用户增长数据点: ${period7d.userGrowthTrend.length} 天`);
    console.log('');

    // 测试 3: 流量指标 (30d)
    console.log('📈 测试 3: 获取流量指标 (Period Metrics - 30d)');
    console.log('='.repeat(50));
    const period30d = await DashboardService.getPeriodMetrics('30d');
    console.log('✅ 30天流量指标获取成功:');
    console.log(`   - 总收入: ¥${period30d.totalRevenue.toFixed(2)}`);
    console.log(`   - 新增订阅: ${period30d.newSubscriptions}`);
    console.log(`   - 流失订阅: ${period30d.churnedSubscriptions}`);
    console.log(`   - 新增用户: ${period30d.newUsers}`);
    console.log(`   - API 调用数: ${period30d.totalApiCalls}`);
    console.log(`   - Token 总数: ${period30d.totalTokens}`);
    console.log('');

    // 测试 4: AI 使用统计
    console.log('🤖 测试 4: 获取 AI 使用统计 (AI Usage Stats)');
    console.log('='.repeat(50));
    const aiUsage = await DashboardService.getAIUsageStats('30d');
    console.log('✅ AI 使用统计获取成功:');
    console.log(`   - 供应商数量: ${aiUsage.byProvider.length}`);
    aiUsage.byProvider.forEach((p) => {
      console.log(`     * ${p.provider}: ${p.calls.toLocaleString()} 次调用 (${p.percentage.toFixed(1)}%)`);
    });
    console.log(`   - 热门模型 TOP 10:`);
    aiUsage.topModels.slice(0, 5).forEach((m, idx) => {
      console.log(`     ${idx + 1}. ${m.model} (${m.provider}): ${m.calls.toLocaleString()} 次调用, ${(m.tokens / 1000000).toFixed(2)}M tokens`);
    });
    console.log(`   - 每小时活跃度数据点: ${aiUsage.hourlyActivity.length}`);
    console.log('');

    // 测试 5: 用户留存率队列
    console.log('📊 测试 5: 获取用户留存率队列 (Retention Cohorts)');
    console.log('='.repeat(50));
    const cohorts = await DashboardService.getRetentionCohorts(10); // 获取最近 10 天
    console.log('✅ 留存率队列获取成功:');
    console.log(`   - 队列数量: ${cohorts.length}`);
    cohorts.slice(0, 5).forEach((c) => {
      console.log(
        `   - ${c.date}: ${c.users} 用户 | D1: ${c.d1.toFixed(1)}% | D7: ${c.d7.toFixed(1)}% | D30: ${c.d30.toFixed(1)}%`,
      );
    });
    console.log('');

    console.log('✅ 所有测试通过!\n');
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
testDashboard()
  .then(() => {
    console.log('🎉 Dashboard 接口测试完成!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 测试过程出错:', error);
    process.exit(1);
  });
