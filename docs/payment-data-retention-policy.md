# 支付数据保留策略

## 数据保留原则

### 1. 已支付订单（status=paid）
- **永久保留** - 涉及财务记录，必须保留
- 关联到 `user_subscription_history` 和 `user_transactions`
- 用于财务对账、退款、纠纷处理

### 2. 未支付订单（status=pending/closed）

#### 短期保留（7天内）
- 保留所有字段
- 用于用户返回支付、转化率分析

#### 中期保留（7-90天）
- 保留完整记录
- 用于业务分析、风控检测

#### 长期归档（90天后）
- **选项 A（推荐）**：移到归档表 `payment_orders_archive`
  - 压缩存储，减少主表查询压力
  - 保留完整数据用于审计

- **选项 B（激进）**：删除 pending/closed 订单
  - 仅保留统计数据（每日订单数、金额等）
  - 节省最多存储空间
  - ⚠️ 丢失详细数据

## 推荐策略

```
pending/closed 订单：
├─ 0-7 天    → 完整保留（用户可能返回支付）
├─ 7-90 天   → 完整保留（业务分析）
└─ 90+ 天    → 移到归档表或删除

paid 订单：
└─ 永久保留（财务审计）
```

## 存储空间估算

假设日均 1000 笔订单，支付转化率 10%：

```
每日新增：
- 100 笔 paid 订单（永久保留）
- 900 笔 pending/closed（90 天后清理）

存储增长：
- 每日：1000 × 2KB = 2MB
- 每年：2MB × 365 = 730MB
- 90天清理后稳定在：~180MB（pending） + 73MB/年（paid）

5年后总存储：~365MB + 180MB = ~550MB
```

**结论**：存储成本极低，无需过度优化

## 实现方案

### 方案 1：定期清理 Cron（推荐）

```typescript
// src/app/(backend)/api/cron/cleanup-orders/route.ts
export async function POST(request: NextRequest) {
  // 1. 清理 90 天前的 pending/closed 订单
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  await serverDB.delete(paymentOrders).where(
    and(
      or(
        eq(paymentOrders.status, 'pending'),
        eq(paymentOrders.status, 'closed')
      ),
      lt(paymentOrders.createdAt, ninetyDaysAgo)
    )
  );
}
```

### 方案 2：数据库分区（企业级）

```sql
-- 按月分区存储
CREATE TABLE payment_orders (
  -- columns...
) PARTITION BY RANGE (created_at);

CREATE TABLE payment_orders_2026_01 PARTITION OF payment_orders
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### 方案 3：数据归档

```typescript
// 移动旧订单到归档表
await serverDB.transaction(async (tx) => {
  // 复制到归档表
  const oldOrders = await tx.select().from(paymentOrders)
    .where(/* 90天前的 pending/closed */);

  await tx.insert(paymentOrdersArchive).values(oldOrders);

  // 从主表删除
  await tx.delete(paymentOrders).where(/* ... */);
});
```

## 其他优化建议

### 1. 索引优化
```sql
-- 主表：只索引活跃订单
CREATE INDEX idx_active_orders ON payment_orders(user_id, status, created_at)
  WHERE status IN ('pending', 'paid');

-- 归档表：压缩索引
CREATE INDEX idx_archive_orders ON payment_orders_archive(order_no)
  WITH (fillfactor=100);
```

### 2. 字段压缩
```typescript
// 对大字段使用压缩
channelData: JSONB,  // PostgreSQL 自动压缩
rawData: TEXT,       // 可用 pg_toast 压缩
```

### 3. 冷热分离
```
热数据（7天内）→ 高性能 SSD
温数据（90天内）→ 普通存储
冷数据（90天+）→ 对象存储（S3/OSS）
```

## 最终建议

对于您的场景（AI 研究助手订阅服务）：

✅ **保留所有订单记录（包括未支付）**
✅ **90 天后归档或删除 pending/closed 订单**
✅ **paid 订单永久保留**
✅ **orderNo 关联必须保留**

理由：
1. 订阅业务订单量不会太大（相比电商）
2. 存储成本 < ¥10/月（5年内）
3. 数据价值远大于存储成本
4. 便于业务分析和用户服务

无需过早优化，当订单量达到百万级再考虑分区/归档。
