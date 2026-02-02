# 一次性付费功能 - 实现进度

**最后更新：** 2026-01-30
**当前状态：** Phase 3 (前端UI) 已完成 ✅

---

## ✅ Phase 1: 数据库准备 (已完成)

### 1.1 Migration脚本创建
- ✅ `scripts/migrations/add-onetime-payment-fields.sql` - 添加字段到三个表
- ✅ `scripts/migrations/reset-users-to-free.sql` - 重置用户到Free方案
- ✅ `scripts/migrations/README.md` - Migration执行文档

### 1.2 Schema更新
- ✅ `packages/database/src/schemas/payment.ts` - 添加 `subscriptionType`, `durationMonths`
- ✅ `packages/database/src/schemas/userExtension.ts` - 两个表都添加了新字段

### 1.3 数据库执行
- ✅ 执行 `add-onetime-payment-fields.sql`
- ✅ 执行 `reset-users-to-free.sql`
- ✅ 运行 `npm run db:generate`
- ✅ 修复依赖问题 (`pnpm install --force`)

---

## ✅ Phase 2: 后端API更新 (已完成)

### 2.1 类型定义更新
**文件：** `src/server/modules/payment/types.ts`

- ✅ 添加 `SubscriptionType` 类型别名
- ✅ `PaymentOrder` 接口添加字段：
  ```typescript
  subscriptionType: SubscriptionType;
  durationMonths?: number;
  ```
- ✅ `CreateOrderInput` 接口添加字段：
  ```typescript
  subscriptionType: SubscriptionType;
  durationMonths?: number;
  ```

### 2.2 PaymentService更新
**文件：** `src/server/modules/payment/index.ts`

- ✅ 添加参数验证逻辑
  - onetime 必须提供 durationMonths (1/3/6/12)
  - recurring 不应提供 durationMonths

- ✅ 实现价格计算逻辑：
  ```typescript
  if (subscriptionType === 'onetime') {
    if (durationMonths === 12) {
      amount = planData.yearlyPrice; // 12个月享年付优惠
    } else {
      amount = planData.monthlyPrice * durationMonths; // 1/3/6个月
    }
  } else {
    amount = planInterval === 'year' ? planData.yearlyPrice : planData.monthlyPrice;
  }
  ```

- ✅ 更新查询已有订单逻辑（包含 subscriptionType）
- ✅ 保存新字段到数据库

### 2.3 tRPC Router更新
**文件：** `src/server/routers/lambda/payment.ts`

- ✅ 更新 `createOrder` 输入schema：
  ```typescript
  subscriptionType: z.enum(['recurring', 'onetime']),
  durationMonths: z.number().optional(),
  ```

- ✅ 添加参数验证规则（`.refine()`）：
  - onetime 时 durationMonths 必填且为 1/3/6/12
  - recurring 时 durationMonths 不应提供

- ✅ 传递新参数到 PaymentService

### 2.4 支付回调处理更新
**文件：** `src/app/(backend)/api/payment/alipay/notify/route.ts`
**文件：** `src/app/(backend)/api/payment/wechat/notify/route.ts`

- ✅ 更新 `calculateExpiresAt()` 函数签名：
  ```typescript
  function calculateExpiresAt(
    subscriptionType: 'recurring' | 'onetime',
    billingInterval: 'month' | 'year',
    durationMonths?: number | null,
  ): Date
  ```

- ✅ 从订单读取 `subscriptionType` 和 `durationMonths`
- ✅ 一次性付费不设置 `nextCreditGrantAt` (不自动续订)
- ✅ 保存新字段到 `user_extensions` 和 `user_subscription_history`
- ✅ 添加类型断言修复 TypeScript 错误

---

## ✅ Phase 3: 前端UI实现 (已完成)

### 3.1 扩展 BillingToggle 为三选项
**文件：** `src/app/[variants]/(main)/subscription/plans/features/BillingToggle.tsx`

- ✅ 扩展 `BillingCycle` 类型为 `'monthly' | 'yearly' | 'onetime'`
- ✅ 添加第三个选项："一次性付费"
- ✅ 直接使用中文（无需国际化）

### 3.2 更新 Client 组件支持一次性付费
**文件：** `src/app/[variants]/(main)/subscription/plans/Client.tsx`

- ✅ 导入 `OnetimePlanCard` 组件
- ✅ 根据 `billingCycle` 值显示不同卡片：
  - `'onetime'` → 显示 `OnetimePlanCard`
  - `'monthly' | 'yearly'` → 显示 `PlanCard`
- ✅ 传递 `subscriptionType` 到卡片组件

### 3.3 创建一次性付费卡片组件
**文件：** `src/app/[variants]/(main)/subscription/plans/features/OnetimePlanCard.tsx` (新建)

- ✅ 完整复制 PlanCard 的特性展示逻辑
- ✅ 添加时长选择下拉框（Select组件）：
  ```tsx
  <Select>
    <Option value={1}>1个月 - ¥{monthlyPrice}</Option>
    <Option value={3}>3个月 - ¥{monthlyPrice * 3}</Option>
    <Option value={6}>6个月 - ¥{monthlyPrice * 6}</Option>
    <Option value={12}>12个月 - ¥{yearlyPrice} + 折扣Tag</Option>
  </Select>
  ```
- ✅ 自动计算12个月的折扣百分比并显示绿色Tag
- ✅ 动态计算总价格
- ✅ 点击"立即购买"打开支付弹窗，传递 `subscriptionType='onetime'` 和 `durationMonths`

### 3.4 修复当前订阅判断BUG
**文件：** `src/app/[variants]/(main)/subscription/plans/features/PlanCard.tsx`

- ✅ 接收 `currentSubscriptionType` 参数
- ✅ 修复只比较 planSlug 的bug
- ✅ 现在同时比较：
  - `planSlug === plan.slug`
  - `subscriptionType === 'recurring'`
  - `billingInterval === (isYearly ? 'year' : 'month')`

### 3.5 更新 PaymentModal
**文件：** `src/features/Payment/PaymentModal.tsx`

- ✅ 添加可选参数：`subscriptionType` 和 `durationMonths`
- ✅ 传递给 `createOrder.mutate()`
- ✅ PlanCard 传递 `subscriptionType='recurring'`
- ✅ OnetimePlanCard 传递 `subscriptionType='onetime'` 和 `durationMonths`

### 3.6 更新 Subscription Router
**文件：** `src/server/routers/lambda/subscription.ts`

- ✅ `getCurrentPlan` 返回值添加字段：
  - `subscriptionType` (默认 'recurring')
  - `durationMonths` (一次性付费的月数)
- ✅ 从 `userExtensions` 读取这两个字段
- ✅ Fallback 值也包含这两个字段

---

## 📋 Phase 4: 测试与验证 (待开始)

- [ ] 4.1 测试一次性付费订单创建（1/3/6/12月）
- [ ] 4.2 验证价格计算正确性
  - 1月 = monthlyPrice × 1
  - 3月 = monthlyPrice × 3
  - 6月 = monthlyPrice × 6
  - 12月 = yearlyPrice
- [ ] 4.3 测试支付回调处理
  - 订阅激活
  - 积分发放
  - 过期时间计算
- [ ] 4.4 测试订阅状态显示
  - 月订阅用户在年订阅tab不显示"当前方案"
  - 一次性付费用户正确显示
- [ ] 4.5 测试一次性付费过期后不自动续订
- [ ] 4.6 测试前端参数篡改安全性
  - 尝试修改 durationMonths
  - 验证后端价格计算不受影响

---

## 💡 实现亮点

### 安全设计
- ✅ **价格计算在后端** - 前端只传递 planId、subscriptionType、durationMonths
- ✅ **参数验证完善** - Zod schema + 后端双重验证
- ✅ **防止价格篡改** - 后端从数据库查询真实价格

### 代码质量
- ✅ **类型安全** - 完整的 TypeScript 类型定义
- ✅ **向后兼容** - 现有 recurring 订阅不受影响
- ✅ **幂等性** - 支付回调处理防重复

### 用户体验
- 🚧 **三种付费模式** - 月订阅/年订阅/一次性付费
- 🚧 **灵活时长选择** - 1/3/6/12个月
- 🚧 **优惠透明** - 12个月享年付优惠

---

## 🎯 下一步行动

**立即开始 Phase 4 (测试与验证)**

1. 启动开发服务器测试UI显示
2. 测试一次性付费订单创建流程
3. 验证价格计算正确性
4. 测试支付回调处理
5. 测试订阅状态显示逻辑

**预估时间：** 2-3小时

---

## 📝 技术债务

1. drizzle-orm 模块解析问题（已通过 pnpm install --force 缓解）
2. Next.js .next 目录下的类型错误（不影响开发）

---

## 🔗 相关文档

- [实现计划](./ONETIME_PAYMENT_IMPLEMENTATION_PLAN.md)
- [设计文档](./ONETIME_PAYMENT_DESIGN.md)
- [Migration README](../scripts/migrations/README.md)
