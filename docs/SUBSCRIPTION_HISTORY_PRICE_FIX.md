# 订阅历史记录价格单位修复

## 问题描述

用户反馈：后台系统的订阅记录页面价格显示不正确
- 修改前显示：1.49元（错误，实际应该是149元）
- 修改后显示：14900元（错误，实际应该是149元）

## 根本原因

**数据库 `user_subscription_history.price` 字段单位不一致：**

| 记录类型 | 存储值 | 实际金额 | 说明 |
|---------|--------|---------|------|
| 类型A | 149 | 149元 | **错误**：存的是"元"为单位 |
| 类型B | 14900 | 149元 | **正确**：存的是"分"为单位 |

### 为什么会出现这种情况？

可能的原因：
1. 历史代码在不同时期使用了不同的单位
2. 数据导入时单位不统一
3. 手动修改数据时使用了错误的单位

## 修复方案

### 第1步：数据迁移（统一单位为"分"）

执行迁移脚本：
```bash
psql -d your_database < migrations/fix-subscription-history-price-unit.sql
```

**迁移逻辑：**
- 假设：`price < 1000` 的记录是"元"为单位（需要 ×100）
- 假设：`price >= 1000` 的记录是"分"为单位（保持不变）
- 执行：将所有 `price < 1000` 的记录乘以100

**示例：**
```sql
-- 转换前
price = 149  → 转换后 price = 14900

-- 保持不变
price = 14900 → 保持 price = 14900
```

### 第2步：代码修改

**前端代码**：`admin-system/src/pages/Subscription/Records/index.tsx`

```typescript
// 修改后：统一除以100转换为元
return `¥ ${(record.price / 100).toFixed(2)}`;
```

**后端代码**：`admin-system/server/src/routes/subscriptions.ts`

```sql
-- 返回原始值（分），不在SQL中转换
h.price,
```

### 第3步：验证

执行迁移后，验证显示：
- 149元的订阅 → 数据库存14900 → 前端显示**¥149.00** ✅
- 599元的订阅 → 数据库存59900 → 前端显示**¥599.00** ✅

## 修复前后对比

### 修复前的错误显示

| 数据库值 | 后端SQL | 后端返回 | 前端显示 | 正确金额 |
|---------|---------|---------|---------|---------|
| 149 | `price/100` | 1.49 | **¥1.49** ❌ | ¥149.00 |
| 14900 | `price/100` | 149 | **¥149.00** ✅ | ¥149.00 |

### 第一次修改后的问题

| 数据库值 | 后端SQL | 后端返回 | 前端显示 | 正确金额 |
|---------|---------|---------|---------|---------|
| 149 | `price` | 149 | **¥149.00** ✅ | ¥149.00 |
| 14900 | `price` | 14900 | **¥14900.00** ❌ | ¥149.00 |

### 完全修复后（数据迁移 + 代码修改）

| 数据库值 | 后端SQL | 后端返回 | 前端显示 | 正确金额 |
|---------|---------|---------|---------|---------|
| 14900 | `price` | 14900 | **¥149.00** ✅ | ¥149.00 |
| 59900 | `price` | 59900 | **¥599.00** ✅ | ¥599.00 |

## 数据单位标准化

### 统一规范

**整个系统的金额字段统一使用"分"为单位：**

| 表名 | 字段 | 单位 | 说明 |
|------|------|------|------|
| `payment_orders` | `amount` | 分 | 实付金额 |
| `payment_orders` | `plan_value` | 分 | 套餐价值 |
| `user_subscription_history` | `price` | 分 | 订阅价格 |
| `subscription_plans` | `monthly_price` | 分 | 月付价格 |
| `subscription_plans` | `yearly_price` | 分 | 年付价格 |

### 前端显示规则

```typescript
// ✅ 正确：除以100转换为元
¥ {(amount / 100).toFixed(2)}

// ❌ 错误：直接显示分
¥ {amount.toFixed(2)}
```

## 预防措施

### 1. 代码规范

**在插入/更新订阅历史记录时，务必使用"分"为单位：**

```typescript
// ✅ 正确
await db.insert(userSubscriptionHistory).values({
  price: 14900, // 149元 = 14900分
  // ...
});

// ❌ 错误
await db.insert(userSubscriptionHistory).values({
  price: 149, // 这会被误认为是149分 = 1.49元
  // ...
});
```

### 2. 数据验证

建议添加数据验证检查，定期检测异常数据：

```sql
-- 检查可能错误的价格（小于1000分 = 10元）
SELECT
  id,
  user_id,
  plan_name,
  price,
  started_at
FROM user_subscription_history
WHERE price > 0 AND price < 1000
ORDER BY started_at DESC;
```

如果发现这类记录，需要人工审核是否需要转换。

### 3. 单元测试

添加单元测试确保价格计算正确：

```typescript
test('subscription history price should be in cents', () => {
  const priceInYuan = 149; // 149元
  const priceInCents = priceInYuan * 100; // 14900分

  const record = {
    price: priceInCents,
    // ...
  };

  const displayed = (record.price / 100).toFixed(2);
  expect(displayed).toBe('149.00');
});
```

## 注意事项

### 迁移脚本的假设

迁移脚本假设 `price < 1000` 的记录是"元"为单位。但如果你的系统有合法的小额订阅（如10元/月），这个假设可能不适用。

**建议：**
1. 先在测试环境执行迁移脚本
2. 检查转换结果是否正确
3. 如有必要，调整脚本中的阈值（如改为 `< 500`）
4. 验证无误后再在生产环境执行

### 回滚方案

如果迁移后发现问题，可以回滚：

```sql
BEGIN;

-- 将价格 >= 1000 的记录除以100（恢复为"元"）
-- 注意：这只适用于误转换的情况
UPDATE user_subscription_history
SET
  price = price / 100,
  updated_at = NOW()
WHERE price >= 1000 AND price < 100000;  -- 假设最高价不超过1000元

COMMIT;
```

**警告**：回滚前请确认哪些记录需要回滚！

## 测试检查清单

### 数据迁移后

- [ ] 执行迁移脚本
- [ ] 检查日志输出，确认更新的记录数
- [ ] 查询是否还有 `price < 1000` 且 `price > 0` 的记录
- [ ] 抽查几条记录，验证价格是否正确

### 后台系统显示

- [ ] 刷新订阅记录页面
- [ ] 验证所有价格显示正确（如149元显示为¥149.00）
- [ ] 验证免费订阅显示为"-"
- [ ] 验证大额订阅（如599元）显示正确

### 回归测试

- [ ] 创建新的订阅记录，确认价格正确
- [ ] 升级订阅，确认价格计算正确
- [ ] 检查支付订单页面显示正常

## 相关文档

- [支付系统全面修复总结](./PAYMENT_FIXES_SUMMARY.md)
- [后台系统支付页面优化](./ADMIN_SYSTEM_PAYMENT_FIX.md)
- [数据迁移脚本](../migrations/fix-subscription-history-price-unit.sql)

## 版本信息

- **发现日期：** 2026年2月5日
- **修复人：** Claude Code
- **影响范围：** 后台管理系统订阅记录页面
- **数据风险：** 中（需要数据迁移）
- **向下兼容：** 是（迁移后保持兼容）
