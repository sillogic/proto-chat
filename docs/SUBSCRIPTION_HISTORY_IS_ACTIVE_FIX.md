# 订阅历史记录 is_active 字段修复

## 问题描述

### 症状
- Dashboard 显示的活跃订阅数偏高
- MRR/ARR 计算结果不准确
- 数据库中一个用户有多条 `is_active = true` 的订阅记录

### 根本原因

**设计模式：** 系统采用"每次续费创建新记录"的模式

**Bug：** 创建新订阅记录时，未将旧记录的 `is_active` 标记为 `false`

**影响范围：**
- 首次支付（payment notify）
- 自动扣款续费（auto-deduct cron）
- 订阅过期处理（subscription cron）

## 行业最佳实践分析

### 两种主流模式

| 模式 | 代表 | 订阅记录 | 计费记录 |
|------|------|---------|---------|
| **模式A** | Recurly | 每次续费创建新记录 | 与订阅记录合并 |
| **模式B** | Stripe/Chargebee | 保持一条记录，更新到期时间 | 单独的 Invoice 表 |

### 当前系统选择

✅ **采用模式A**（每次续费创建新记录）

**理由：**
1. 表名 `user_subscription_**history**` 暗示历史记录表
2. 已有大量数据按此模式创建
3. 完整的订阅历史对财务审计很重要
4. 最小改动，只需修复 `is_active` 维护逻辑

**核心规则：** 每个用户在同一时间只有一条 `is_active = true` 的记录

## 修复方案

### 代码修复

#### 1. 自动扣款 (auto-deduct/route.ts)

```typescript
// 续费成功时
await serverDB.transaction(async (tx) => {
  // 1. 标记旧记录为失效
  await tx
    .update(userSubscriptionHistory)
    .set({ isActive: false, updatedAt: now })
    .where(
      and(
        eq(userSubscriptionHistory.userId, agreement.userId),
        eq(userSubscriptionHistory.isActive, true)
      )
    );

  // 2. 创建新记录
  await tx.insert(userSubscriptionHistory).values({
    isActive: true,  // 明确设置为 true
    // ...
  });
});

// 扣款失败降级时
await serverDB.transaction(async (tx) => {
  // 1. 标记旧记录为失效
  await tx.update(userSubscriptionHistory)...

  // 2. 创建过期记录
  await tx.insert(userSubscriptionHistory).values({
    isActive: false,  // 过期记录标记为 false
    status: 'expired',
    // ...
  });
});
```

#### 2. 支付回调 (alipay/notify/route.ts, wechat/notify/route.ts)

```typescript
// 首次支付成功时
await serverDB.transaction(async (tx) => {
  // 1. 标记旧记录为失效（如果用户之前有订阅）
  await tx
    .update(userSubscriptionHistory)
    .set({ isActive: false, updatedAt: now })
    .where(
      and(
        eq(userSubscriptionHistory.userId, order.userId),
        eq(userSubscriptionHistory.isActive, true)
      )
    );

  // 2. 创建新订阅记录
  await tx.insert(userSubscriptionHistory).values({
    isActive: true,
    status: 'active',
    // ...
  });
});
```

#### 3. 订阅过期处理 (subscription/route.ts)

```typescript
// 订阅过期时
await serverDB.transaction(async (tx) => {
  // 1. 标记旧记录为失效
  await tx
    .update(userSubscriptionHistory)
    .set({ isActive: false, updatedAt: now })
    .where(
      and(
        eq(userSubscriptionHistory.userId, user.userId),
        eq(userSubscriptionHistory.isActive, true)
      )
    );

  // 2. 创建过期记录
  await tx.insert(userSubscriptionHistory).values({
    isActive: false,  // 过期记录标记为 false
    status: 'expired',
    // ...
  });
});
```

### 数据修复

执行迁移脚本修复历史数据：

```bash
psql -d your_database < migrations/fix-subscription-history-is-active.sql
```

**脚本逻辑：**
1. 统计当前问题规模（有多少用户有多条 active 记录）
2. 为每个用户找到应该保持 `is_active = true` 的记录：
   - `status = 'active'`
   - `ended_at > NOW()` 或 `ended_at IS NULL`
   - 如果有多条符合，选择最新创建的记录
3. 将所有记录标记为 `is_active = false`
4. 将选定的记录恢复为 `is_active = true`
5. 验证修复结果

## 修复前后对比

### 修复前

```
用户A的订阅记录：
├── 2024-01-01  月付  active  is_active=true  ❌ 应该是 false
├── 2024-02-01  月付  active  is_active=true  ❌ 应该是 false
└── 2024-03-01  月付  active  is_active=true  ✅ 正确

Dashboard 统计：用户A有3个活跃订阅 ❌
MRR 计算：10 + 10 + 10 = 30 ❌
```

### 修复后

```
用户A的订阅记录：
├── 2024-01-01  月付  active  is_active=false  ✅ 历史记录
├── 2024-02-01  月付  active  is_active=false  ✅ 历史记录
└── 2024-03-01  月付  active  is_active=true   ✅ 当前订阅

Dashboard 统计：用户A有1个活跃订阅 ✅
MRR 计算：10 ✅
```

## 验证步骤

### 1. 检查多条 active 记录的用户

```sql
SELECT
    user_id,
    COUNT(*) as active_count
FROM user_subscription_history
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1;
```

**预期结果：** 0 行（修复后不应该有任何用户有多条 active 记录）

### 2. 验证 Dashboard 统计

```sql
-- 活跃订阅数
SELECT COUNT(*) as active_subscriptions
FROM user_subscription_history
WHERE is_active = true
  AND status = 'active'
  AND (ended_at IS NULL OR ended_at > NOW());
```

**预期：** 与实际付费用户数匹配

### 3. 验证 MRR 计算

```sql
-- 计算 MRR（按月计算）
SELECT
    SUM(
        CASE
            WHEN h.billing_interval = 'year' THEN p.yearly_price / 12
            ELSE p.monthly_price
        END
    ) / 100.0 as mrr
FROM user_subscription_history h
JOIN subscription_plans p ON h.plan_id = p.id
WHERE h.is_active = true
  AND h.status = 'active'
  AND (h.ended_at IS NULL OR h.ended_at > NOW());
```

**预期：** 与实际收入匹配

### 4. 抽查用户订阅记录

```sql
SELECT
    user_id,
    id,
    plan_name,
    status,
    is_active,
    started_at,
    ended_at,
    created_at
FROM user_subscription_history
WHERE user_id = 'specific-user-id'
ORDER BY created_at DESC;
```

**预期：**
- 最新的有效订阅：`is_active = true`
- 所有历史记录：`is_active = false`

## 数据一致性规则

### 核心规则

✅ **每个用户在同一时间只有一条 `is_active = true` 的记录**

### 例外情况

❌ **不应该有例外！** 如果发现用户有多条 `is_active = true` 的记录，说明代码有Bug或数据损坏。

### 什么时候 `is_active = true`

- 用户当前正在使用的订阅
- `status = 'active'`
- `ended_at > NOW()` 或 `ended_at IS NULL`

### 什么时候 `is_active = false`

- 历史订阅记录（已被新订阅替换）
- 已过期的订阅（`status = 'expired'`）
- 已取消的订阅（`status = 'canceled'`）
- 已升级的订阅（`status = 'upgraded'`）

## 预防措施

### 1. 代码规范

**在任何创建新订阅记录的地方，必须先标记旧记录为失效：**

```typescript
// ✅ 正确模式
await serverDB.transaction(async (tx) => {
  // 第1步：标记旧记录为失效
  await tx
    .update(userSubscriptionHistory)
    .set({ isActive: false, updatedAt: now })
    .where(
      and(
        eq(userSubscriptionHistory.userId, userId),
        eq(userSubscriptionHistory.isActive, true)
      )
    );

  // 第2步：创建新记录
  await tx.insert(userSubscriptionHistory).values({
    isActive: true,
    // ...
  });
});

// ❌ 错误模式
await serverDB.insert(userSubscriptionHistory).values({
  isActive: true,  // 没有先标记旧记录为失效！
  // ...
});
```

### 2. 单元测试

添加测试确保 `is_active` 维护正确：

```typescript
test('should mark old subscription as inactive when creating new one', async () => {
  // 创建第一个订阅
  const sub1 = await createSubscription(userId, 'plan_lite');
  expect(sub1.isActive).toBe(true);

  // 创建第二个订阅（续费）
  const sub2 = await createSubscription(userId, 'plan_lite');

  // 验证：旧订阅应该被标记为 inactive
  const oldSub = await getSubscription(sub1.id);
  expect(oldSub.isActive).toBe(false);

  // 验证：新订阅应该是 active
  expect(sub2.isActive).toBe(true);

  // 验证：用户只有一条 active 记录
  const activeSubs = await getActiveSubscriptions(userId);
  expect(activeSubs).toHaveLength(1);
  expect(activeSubs[0].id).toBe(sub2.id);
});
```

### 3. 数据验证脚本

定期运行检查脚本：

```bash
# 检查数据一致性
psql -d your_database -c "
SELECT
    user_id,
    COUNT(*) as active_count
FROM user_subscription_history
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1;
"
```

**预期结果：** 0 行

如果发现问题，立即执行修复脚本。

### 4. 监控告警

在 Dashboard 服务中添加检查：

```typescript
// 检查数据一致性
export async function checkSubscriptionDataIntegrity(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // 检查是否有用户有多条 active 记录
  const multipleActiveResult = await db.execute(sql`
    SELECT user_id, COUNT(*) as count
    FROM user_subscription_history
    WHERE is_active = true
    GROUP BY user_id
    HAVING COUNT(*) > 1
  `);

  if (multipleActiveResult.length > 0) {
    issues.push(
      `Found ${multipleActiveResult.length} users with multiple active subscriptions`
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
```

定期调用此函数并发送告警。

## 影响分析

### 修复的影响

✅ **正面影响：**
- Dashboard 统计准确
- MRR/ARR 计算正确
- 数据一致性提高
- 便于查询用户当前订阅

❌ **无负面影响：**
- 所有历史记录保留
- 不影响业务逻辑
- 向后兼容

### 依赖此字段的代码

1. **Dashboard 统计** (dashboard-service.ts:126-138)
   ```typescript
   .where(
     and(
       eq(userSubscriptionHistory.isActive, true),
       eq(userSubscriptionHistory.status, 'active'),
       or(
         sql`user_subscription_history.ended_at IS NULL`,
         gte(userSubscriptionHistory.endedAt, now),
       ),
     ),
   )
   ```

2. **后台订阅记录页面** (admin-system)
   - 可以添加筛选：只显示 `is_active = true` 的记录
   - 或者全部显示，但高亮当前活跃的订阅

## 相关文档

- [订阅记录页面优化](./SUBSCRIPTION_RECORDS_OPTIMIZATION.md)
- [支付系统全面修复总结](./PAYMENT_FIXES_SUMMARY.md)
- [数据迁移脚本](../migrations/fix-subscription-history-is-active.sql)

## 版本信息

- **问题发现：** 2026年2月5日
- **修复人：** Claude Code
- **影响范围：** 订阅历史记录数据完整性
- **严重程度：** 高（影响统计数据准确性）
- **修复方式：** 代码修复 + 数据迁移

---

## 总结

**问题原因：**
- 采用"每次续费创建新记录"模式
- 创建新记录时未标记旧记录为 `is_active = false`

**修复方法：**
1. 修复所有创建订阅记录的代码
2. 执行数据迁移脚本修复历史数据
3. 添加测试和监控预防复发

**核心规则：**
- ✅ 每个用户在同一时间只有一条 `is_active = true` 的记录
- ✅ 历史记录保持 `is_active = false`
- ✅ 创建新记录前先标记旧记录为失效

**预期效果：**
- Dashboard 统计准确
- MRR/ARR 计算正确
- 数据一致性提高
