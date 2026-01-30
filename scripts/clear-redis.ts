/**
 * Redis 会话缓存清理脚本
 *
 * 执行方式: npx tsx scripts/clear-redis.ts
 */

import Redis from 'ioredis';

const redis = new Redis({
  host: 'r-wz921llklqw6sxzp6dpd.redis.rds.aliyuncs.com',
  port: 6379,
  password: process.env.REDIS_PASSWORD || 'Sillogic@Redis123',
});

async function clearRedis() {
  console.log('🔗 连接 Redis...');

  try {
    // 测试连接
    await redis.ping();
    console.log('✅ Redis 连接成功');

    // 获取所有 lobechat 前缀的 key
    const keys = await redis.keys('lobechat:*');
    console.log(`📋 找到 ${keys.length} 个 lobechat 相关的 key`);

    if (keys.length > 0) {
      // 显示将要删除的 key（最多显示 20 个）
      console.log('');
      console.log('将要删除的 key:');
      keys.slice(0, 20).forEach((key) => console.log(`  - ${key}`));
      if (keys.length > 20) {
        console.log(`  ... 还有 ${keys.length - 20} 个`);
      }
      console.log('');

      // 删除所有相关 key
      await redis.del(...keys);
      console.log(`✅ 已删除 ${keys.length} 个 key`);
    } else {
      console.log('✅ 无需清理');
    }
  } catch (error) {
    console.error('❌ Redis 操作失败:', error);
  } finally {
    await redis.quit();
    console.log('');
    console.log('✅ Redis 清理完成！');
  }
}

clearRedis();
