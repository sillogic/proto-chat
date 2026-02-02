# 一次性付费功能实现计划

## 项目概述

实现三种订阅付费模式：
1. **月订阅** - recurring + billingInterval='month'
2. **年订阅** - recurring + billingInterval='year'
3. **一次性付费** - onetime + durationMonths=1/3/6/12

## 价格策略

**订阅方案（自动续订）：**
- 月订阅：`monthlyPrice` 元/月
- 年订阅：`yearlyPrice` 元/年（优惠价）

**一次性付费（不自动续订）：**
- 1个月：`monthlyPrice × 1`
- 3个月：`monthlyPrice × 3`
- 6个月：`monthlyPrice × 6`
- 12个月：`yearlyPrice`（享受与年订阅相同的优惠）

**安全保障：** 前端只传递 `planId` 和参数，价格由后端从数据库查询并计算，杜绝篡改风险。

---

## ✅ 已完成工作

### 1. 数据库Migration脚本
**文件路径：** `scripts/migrations/`

- ✅ `add-onetime-payment-fields.sql` - 添加 `subscription_type` 和 `duration_months` 字段
  - 更新 `payment_orders` 表
  - 更新 `user_extensions` 表
  - 更新 `user_subscription_history` 表
  - 添加 CHECK 约束和索引
  - 设置现有数据默认值为 'recurring'

- ✅ `reset-users-to-free.sql` - 重置所有付费用户到Free方案
  - 重置 `user_extensions.current_plan = 'free'`
  - 标记订阅历史为 `expired`
  - 关闭所有待支付订单
  - 包含备份和回滚方案

- ✅ `README.md` - Migration执行说明文档

### 2. Drizzle Schema更新
**文件路径：** `packages/database/src/schemas/`

- ✅ `payment.ts` - 添加字段到 `paymentOrders` 表
  ```typescript
  subscriptionType: varchar('subscription_type', { length: 20 }).default('recurring').notNull(),
  durationMonths: integer('duration_months'),
  ```

- ✅ `userExtension.ts` - 添加字段到两个表
  - `userExtensions` 表添加 `subscriptionType` 和 `durationMonths`
  - `userSubscriptionHistory` 表添加 `subscriptionType` 和 `durationMonths`

---

## 📋 待实现任务

### Phase 1: 数据库准备 (30分钟)

- [ ] 1.1 执行 `add-onetime-payment-fields.sql` migration
- [ ] 1.2 执行 `reset-users-to-free.sql` 重置用户
- [ ] 1.3 运行 `bun run db:generate` 重新生成Drizzle类型
- [ ] 1.4 运行 `bun run type-check` 确保类型无误

### Phase 2: 后端API更新 (2-3小时)

#### 2.1 更新类型定义
**文件：** `src/server/modules/payment/types.ts`

```typescript
export interface CreateOrderInput {
  userId: string;
  planId: string;
  planInterval: 'month' | 'year';
  payChannel: 'wechat_native' | 'alipay_precreate';
  subscriptionType: 'recurring' | 'onetime';
  durationMonths?: number; // Required when subscriptionType = 'onetime'
}
```

#### 2.2 更新PaymentService
**文件：** `src/server/modules/payment/index.ts`

- [ ] 更新 `createOrder()` 方法
  - 验证参数组合（onetime必须有durationMonths）
  - 根据subscriptionType和durationMonths计算金额：
    ```typescript
    let amount: number;
    if (subscriptionType === 'onetime') {
      if (durationMonths === 12) {
        amount = planData.yearlyPrice;
      } else if ([1, 3, 6].includes(durationMonths)) {
        amount = planData.monthlyPrice * durationMonths;
      } else {
        throw new Error('Invalid duration_months');
      }
    } else {
      amount = planInterval === 'year' ? planData.yearlyPrice : planData.monthlyPrice;
    }
    ```
  - 保存 `subscriptionType` 和 `durationMonths` 到订单

#### 2.3 更新tRPC Router
**文件：** `src/server/routers/lambda/payment.ts`

- [ ] 更新 `createOrder` 的输入schema：
  ```typescript
  .input(
    z.object({
      planId: z.string(),
      interval: z.enum(['month', 'year']),
      payChannel: z.enum(['wechat_native', 'alipay_precreate']),
      subscriptionType: z.enum(['recurring', 'onetime']),
      durationMonths: z.number().optional().refine((val) => {
        return val === undefined || [1, 3, 6, 12].includes(val);
      }),
    }).refine((data) => {
      if (data.subscriptionType === 'onetime' && !data.durationMonths) {
        return false;
      }
      return true;
    }, {
      message: 'durationMonths is required for onetime subscriptions',
    })
  )
  ```

#### 2.4 更新支付回调处理
**文件：** `src/app/(backend)/api/payment/alipay/notify/route.ts`
**文件：** `src/app/(backend)/api/payment/wechat/notify/route.ts`

- [ ] 更新订阅激活逻辑
  - 从订单获取 `subscriptionType` 和 `durationMonths`
  - 根据类型计算过期时间：
    ```typescript
    function calculateExpiresAt(
      subscriptionType: string,
      billingInterval: string,
      durationMonths?: number
    ): Date {
      const now = new Date();
      const expiresAt = new Date(now);

      if (subscriptionType === 'onetime') {
        expiresAt.setMonth(expiresAt.getMonth() + (durationMonths || 1));
      } else if (billingInterval === 'year') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      return expiresAt;
    }
    ```
  - 一次性付费不设置 `nextCreditGrantAt`（不自动续订）
  - 保存 `subscriptionType` 和 `durationMonths` 到 `user_extensions` 和 `user_subscription_history`

### Phase 3: 前端UI实现 (4-5小时)

#### 3.1 创建三Tab布局
**文件：** `src/app/[variants]/(main)/subscription/plans/Client.tsx`

- [ ] 添加 `<Tabs>` 组件，三个标签：
  - 月订阅
  - 年订阅
  - 一次性付费

#### 3.2 创建一次性付费卡片组件
**文件：** `src/features/Subscription/OnetimePlanCard.tsx` (新建)

- [ ] 显示方案基本信息
- [ ] 显示四个时长选项的价格列表：
  ```tsx
  <Select
    options={[
      { label: '1个月 - ¥120', value: 1 },
      { label: '3个月 - ¥360', value: 3 },
      { label: '6个月 - ¥720', value: 6 },
      { label: '12个月 - ¥1080（优惠价）', value: 12 },
    ]}
  />
  ```
- [ ] 高亮12个月选项显示折扣百分比

#### 3.3 更新订阅按钮逻辑
**文件：** `src/app/[variants]/(main)/subscription/plans/features/PlanCard.tsx`

- [ ] 修复当前订阅判断BUG：
  ```typescript
  // ❌ BUG: 只比较 planSlug
  const isCurrentPlan = currentPlanSlug === plan.slug;

  // ✅ FIX: 同时比较 planSlug + billingInterval + subscriptionType
  const isCurrentPlan =
    currentPlan?.planSlug === plan.slug &&
    currentPlan?.billingInterval === billingCycle &&
    currentPlan?.subscriptionType === 'recurring';
  ```

#### 3.4 更新PaymentModal
**文件：** `src/features/Payment/PaymentModal.tsx`

- [ ] 接收新参数 `subscriptionType` 和 `durationMonths`
- [ ] 传递给 `createOrder` mutation

#### 3.5 更新i18n文本
**文件：** `src/locales/default/subscription.ts`

- [ ] 添加一次性付费相关文案：
  ```typescript
  onetime: {
    title: '一次性付费',
    description: '无需自动续订，按需购买',
    duration: {
      1: '1个月',
      3: '3个月',
      6: '6个月',
      12: '12个月（享年付优惠）',
    },
  }
  ```

### Phase 4: 测试与验证 (2-3小时)

- [ ] 4.1 测试三种付费模式的订单创建
- [ ] 4.2 测试价格计算的正确性
- [ ] 4.3 测试支付回调处理
- [ ] 4.4 测试订阅状态显示
- [ ] 4.5 测试一次性付费过期后的行为（不自动续订）
- [ ] 4.6 测试前端篡改参数的安全性

---

## 执行步骤

### 第一步：运行数据库Migration

```bash
# 1. 连接数据库（根据你的数据库工具选择）
psql -U your_username -d your_database

# 2. 执行添加字段的migration
\i scripts/migrations/add-onetime-payment-fields.sql

# 3. 执行重置用户的migration（可选，用于测试）
\i scripts/migrations/reset-users-to-free.sql

# 4. 验证字段添加成功
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_extensions'
  AND column_name IN ('subscription_type', 'duration_months');

# 5. 重新生成Drizzle类型
bun run db:generate

# 6. 类型检查
bun run type-check
```

### 第二步：依次实现各Phase任务

按照上面列出的Phase 2-4顺序实现。

---

## 预估时间

- Phase 1 (数据库准备): 30分钟
- Phase 2 (后端API): 2-3小时
- Phase 3 (前端UI): 4-5小时
- Phase 4 (测试): 2-3小时

**总计：9-12小时**

---

## 注意事项

1. **安全第一**：所有价格计算必须在后端完成，前端只传递参数
2. **向后兼容**：现有recurring订阅不受影响
3. **幂等性**：支付回调需要处理重复通知
4. **类型安全**：所有改动后运行 `bun run type-check`
5. **测试覆盖**：每个功能点都要测试

---

## 当前状态

✅ 数据库Schema已更新
✅ Migration脚本已创建
⏳ 等待执行Migration
⏳ 等待后端API实现
⏳ 等待前端UI实现

---

**下一步行动：** 执行数据库Migration，然后开始Phase 2后端API开发。
