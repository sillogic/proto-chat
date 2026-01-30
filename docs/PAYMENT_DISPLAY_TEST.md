# 支付订单信息显示测试

**创建日期：** 2026-01-30

---

## 测试目的

验证优化后的支付订单信息显示是否符合预期。

---

## 测试场景

### 场景 1：Lite 月订阅

**输入：**
```typescript
{
  planId: 'plan_lite_mo',
  planSlug: 'lite',
  planName: 'Lite',
  planInterval: 'month',
  subscriptionType: 'recurring'
}
```

**预期显示：**
- 支付宝 subject: `Lite Monthly Plan`
- 微信 body: `Lite Monthly Plan`

---

### 场景 2：Pro 年订阅

**输入：**
```typescript
{
  planId: 'plan_pro_mo',
  planSlug: 'pro',
  planName: 'Pro',
  planInterval: 'year',
  subscriptionType: 'recurring'
}
```

**预期显示：**
- 支付宝 subject: `Pro Annual Plan`
- 微信 body: `Pro Annual Plan`

---

### 场景 3：Ultra 一次性 3 个月

**输入：**
```typescript
{
  planId: 'plan_ultra_mo',
  planSlug: 'ultra',
  planName: 'Ultra',
  planInterval: 'month',
  subscriptionType: 'onetime',
  durationMonths: 3
}
```

**预期显示：**
- 支付宝 subject: `Ultra Monthly Plan - 3mo`
- 微信 body: `Ultra Monthly Plan - 3mo`

---

### 场景 4：Lite 一次性 12 个月

**输入：**
```typescript
{
  planId: 'plan_lite_mo',
  planSlug: 'lite',
  planName: 'Lite',
  planInterval: 'month',
  subscriptionType: 'onetime',
  durationMonths: 12
}
```

**预期显示：**
- 支付宝 subject: `Lite Monthly Plan - 12mo`
- 微信 body: `Lite Monthly Plan - 12mo`

---

### 场景 5：降级兼容（无 planSlug）

**输入：**
```typescript
{
  planId: 'plan_pro_mo',
  planSlug: undefined,
  planName: undefined,
  planInterval: 'year',
  subscriptionType: 'recurring'
}
```

**预期显示（降级到 planId）：**
- 支付宝 subject: `plan_pro_mo Annual Plan`
- 微信 body: `plan_pro_mo Annual Plan`

---

## 测试步骤

### 1. 准备测试环境

```bash
# 启动开发服务器
pnpm dev

# 确保支付配置正确
# 检查 .env 文件中的支付宝/微信配置
```

### 2. 创建测试订单

使用前端页面或 tRPC API 创建测试订单：

```typescript
// tRPC call example
trpc.payment.createOrder.mutate({
  planId: 'plan_lite_mo',
  planInterval: 'month',
  payChannel: 'alipay_precreate',
  subscriptionType: 'recurring'
})
```

### 3. 检查订单信息

#### 方法 A：查看数据库

```sql
-- 查看最新订单
SELECT order_no, plan_id, plan_interval, subscription_type, amount
FROM payment_orders
ORDER BY created_at DESC
LIMIT 5;
```

#### 方法 B：支付宝沙箱

1. 获取支付二维码
2. 使用支付宝沙箱扫码
3. 查看订单详情中的 "商品名称" 字段

#### 方法 C：查看日志

```bash
# 查看 PaymentService 创建订单日志
tail -f logs/app.log | grep -A 5 "createPayment"
```

### 4. 验证预期

对比实际显示与预期显示是否一致。

---

## 预期结果

✅ **所有场景的订单信息显示应该：**
1. 清晰易懂（如 "Lite Monthly Plan"）
2. 不包含内部 ID（如 "plan_lite_mo"）
3. 不出现中文乱码
4. 一次性付费显示时长（如 "- 3mo"）

---

## 问题排查

### 问题 1：仍然显示 plan_id

**可能原因：**
- PaymentService 未正确传递 planSlug/planName
- 支付渠道未接收到这些字段

**排查步骤：**
1. 在 `src/server/modules/payment/index.ts` 的 `createOrder` 方法中添加日志：
   ```typescript
   console.log('Plan metadata:', {
     planSlug: planData.slug,
     planName: planData.name
   });
   ```

2. 在支付渠道的 `createPayment` 方法中添加日志：
   ```typescript
   console.log('Received order:', {
     planId: order.planId,
     planSlug: order.planSlug,
     planName: order.planName
   });
   ```

### 问题 2：显示 "undefined"

**可能原因：**
- 数据库中的 subscription_plans 表缺少 slug 或 name 字段
- 查询结果为空

**排查步骤：**
```sql
-- 检查方案数据
SELECT id, slug, name FROM subscription_plans;
```

### 问题 3：中文仍然乱码

**可能原因：**
- 使用了 planName（中文）而不是 planSlug（英文）

**解决方案：**
确保使用 planSlug 作为主要显示字段，planName 仅作为备用。

---

## 回滚方案

如果优化导致问题，可以快速回滚：

```bash
# 1. 回滚代码修改
git checkout HEAD~1 -- src/server/modules/payment/

# 2. 重启服务
pnpm dev
```

---

## 性能影响

### 额外查询

无，因为 PaymentService 已经查询了 subscription_plans 表，只是多传递了两个字段。

### 额外存储

无，planSlug 和 planName 不存储到数据库，仅在创建支付订单时使用。

---

## 未来改进

1. **国际化支持**：根据用户语言显示不同语言的订单信息
   ```typescript
   const subject = locale === 'zh-CN'
     ? `${planName} ${intervalCN}`
     : `${planSlug} ${intervalEN} Plan`;
   ```

2. **自定义显示格式**：允许在配置中自定义订单信息格式
   ```typescript
   const format = config.orderFormat || '{plan} {interval} Plan';
   ```

3. **A/B 测试**：测试不同的显示格式对转化率的影响

---

## 相关文档

- [方案 ID 优化总结](./PLAN_ID_OPTIMIZATION.md)
- [一次性付费功能进度](./ONETIME_PAYMENT_PROGRESS.md)
