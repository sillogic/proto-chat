# 一次性付费功能实现总结

## 📊 实现状态

✅ Phase 1: 数据库准备 - 已完成
✅ Phase 2: 后端API更新 - 已完成
✅ Phase 3: 前端UI实现 - 已完成
⏳ Phase 4: 测试与验证 - 待开始

---

## 📝 修改文件清单

### 数据库相关 (3个文件)

1. **`packages/database/src/schemas/payment.ts`**
   - 添加 `subscriptionType` 和 `durationMonths` 字段到 `paymentOrders` 表

2. **`packages/database/src/schemas/userExtension.ts`**
   - 添加 `subscriptionType` 和 `durationMonths` 字段到 `userExtensions` 表
   - 添加 `subscriptionType` 和 `durationMonths` 字段到 `userSubscriptionHistory` 表

3. **Migration脚本**
   - `scripts/migrations/add-onetime-payment-fields.sql` (新建)
   - `scripts/migrations/reset-users-to-free.sql` (新建)
   - `scripts/migrations/README.md` (新建)

### 后端API (6个文件)

4. **`src/server/modules/payment/types.ts`**
   - 添加 `SubscriptionType` 类型
   - `PaymentOrder` 接口添加 `subscriptionType` 和 `durationMonths`
   - `CreateOrderInput` 接口添加 `subscriptionType` 和 `durationMonths`

5. **`src/server/modules/payment/index.ts`**
   - 添加参数验证（onetime必须有durationMonths）
   - 实现智能价格计算逻辑
   - 保存新字段到数据库

6. **`src/server/routers/lambda/payment.ts`**
   - 更新 `createOrder` 输入schema
   - 添加Zod验证规则

7. **`src/app/(backend)/api/payment/alipay/notify/route.ts`**
   - 更新 `calculateExpiresAt()` 函数
   - 一次性付费不设置自动续订
   - 保存新字段到用户表

8. **`src/app/(backend)/api/payment/wechat/notify/route.ts`**
   - 与Alipay回调相同的修改

9. **`src/server/routers/lambda/subscription.ts`**
   - `getCurrentPlan` 返回 `subscriptionType` 和 `durationMonths`

### 前端UI (6个文件)

10. **`src/app/[variants]/(main)/subscription/plans/features/BillingToggle.tsx`**
    - 扩展 `BillingCycle` 为三个选项
    - 添加"一次性付费"选项（中文）

11. **`src/app/[variants]/(main)/subscription/plans/Client.tsx`**
    - 导入 `OnetimePlanCard`
    - 根据 `billingCycle` 显示不同卡片
    - 传递 `currentSubscriptionType` 到卡片组件

12. **`src/app/[variants]/(main)/subscription/plans/features/OnetimePlanCard.tsx`** (新建)
    - 完整的一次性付费卡片组件
    - 时长选择下拉框（1/3/6/12月）
    - 动态价格计算和折扣显示
    - 集成 PaymentModal

13. **`src/app/[variants]/(main)/subscription/plans/features/PlanCard.tsx`**
    - 接收 `currentSubscriptionType` 参数
    - 修复订阅状态判断BUG（同时比较 planSlug + billingInterval + subscriptionType）
    - 传递 `subscriptionType='recurring'` 到 PaymentModal

14. **`src/features/Payment/PaymentModal.tsx`**
    - 添加可选参数 `subscriptionType` 和 `durationMonths`
    - 传递新参数到 `createOrder.mutate()`

15. **`src/app/[variants]/(main)/subscription/hooks/useSubscriptionPlans.ts`**
    - 类型定义无需修改（后端返回值已更新）

### 文档 (3个文件)

16. **`docs/ONETIME_PAYMENT_DESIGN.md`** (新建)
17. **`docs/ONETIME_PAYMENT_IMPLEMENTATION_PLAN.md`** (新建)
18. **`docs/ONETIME_PAYMENT_PROGRESS.md`** (新建)

---

## 🔑 核心功能

### 价格策略

**订阅方案（自动续订）：**
- 月订阅：月付价 元/月
- 年订阅：年付价 元/年（优惠）

**一次性付费（不自动续订）：**
- 1个月：月付价 × 1
- 3个月：月付价 × 3
- 6个月：月付价 × 6
- 12个月：年付价（享受年订阅优惠）

### 安全保障

所有价格计算在**后端**完成：
```typescript
// 前端只传递参数
{ planId, subscriptionType, durationMonths }

// 后端从数据库查询并计算
amount = durationMonths === 12
  ? planData.yearlyPrice
  : planData.monthlyPrice * durationMonths
```

用户**无法篡改**价格！

### 用户体验

1. **三种付费模式**
   - 年订阅（自动续订）
   - 月订阅（自动续订）
   - 一次性付费（无需续订）

2. **灵活时长选择**
   - 1个月、3个月、6个月、12个月
   - 12个月享年付优惠

3. **透明折扣显示**
   - 12个月选项显示折扣百分比
   - 实时计算立省金额

4. **准确订阅状态**
   - 月订阅用户在年订阅tab不显示"当前方案"
   - 一次性付费用户正确识别

---

## 🐛 修复的BUG

### 订阅状态判断BUG

**问题：** 月订阅用户在年订阅tab显示为"我的订阅"

**原因：** 只比较 `planSlug`，没有比较 `billingInterval` 和 `subscriptionType`

**修复：**
```typescript
// ❌ 之前
const isCurrentPlan = currentPlanSlug === plan.slug;

// ✅ 现在
const isCurrentPlan =
  currentPlanSlug === plan.slug &&
  currentSubscriptionType === 'recurring' &&
  currentBillingInterval === (isYearly ? 'year' : 'month');
```

---

## 🧪 待测试项

### 基础功能
- [ ] 三个Tab切换正常
- [ ] OnetimePlanCard显示正确
- [ ] 时长选择器工作正常
- [ ] 价格计算准确

### 支付流程
- [ ] 创建一次性付费订单（1/3/6/12月）
- [ ] 生成支付二维码
- [ ] 扫码支付成功
- [ ] 回调处理正确

### 订阅状态
- [ ] 一次性付费后正确显示订阅信息
- [ ] 过期时间计算正确
- [ ] 不自动续订（nextCreditGrantAt为null）
- [ ] 订阅状态判断准确（月订阅不在年订阅tab显示）

### 安全性
- [ ] 尝试篡改前端参数（durationMonths）
- [ ] 验证后端价格计算不受影响
- [ ] 订单金额与后端计算一致

---

## 📈 下一步

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **访问订阅页面测试**
   - 切换三个Tab
   - 选择不同时长
   - 查看价格计算

3. **测试支付流程**
   - 创建订单
   - 生成二维码
   - 完成支付（沙箱环境）

4. **验证数据库**
   - 检查订单记录
   - 检查用户订阅状态
   - 检查积分发放

---

## 💡 技术亮点

1. **类型安全** - 完整的TypeScript类型定义
2. **向后兼容** - 现有订阅不受影响
3. **代码复用** - OnetimePlanCard复用PlanCard样式
4. **用户友好** - 清晰的价格展示和折扣提示
5. **安全第一** - 所有价格计算在后端

---

**总文件数：** 18个文件
- 新建：6个
- 修改：12个
