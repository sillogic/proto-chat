# 一次性付费功能设计方案

**创建时间：** 2026-01-30
**状态：** 设计阶段

---

## 📋 需求分析

### 当前问题

1. **订阅状态判断错误**
   - 问题：用户订阅月付 PRO，切换到年付 Tab 时，PRO 也显示为"当前方案"
   - 原因：只判断了 `planSlug`，没有判断 `billingInterval`

2. **缺少一次性付费选项**
   - 需要：类似截图中的下拉选择器
   - 支持：1个月、3个月、6个月、12个月
   - 定价：提供不同的折扣优惠

3. **数据库字段不够**
   - 现有：`billingInterval` 只支持 'month' | 'year'
   - 缺少：区分"订阅"和"一次性购买"的字段
   - 缺少：记录一次性购买周期长度的字段

---

## 🎯 功能设计

### 1. 三种付费模式对比

| 付费模式 | 说明 | 到期后行为 | 计费周期 | 优惠 |
|---------|------|-----------|---------|------|
| **月付** | 按月订阅 | 自动续费 | 每月 | 无 |
| **年付** | 按年订阅 | 自动续费 | 每年 | 20-23% |
| **一次性** | 一次性购买 | 不续费 | 1/3/6/12个月 | 按周期递增 |

### 2. 一次性付费周期定价

以 PRO 方案为例（假设月付 $29.9）：

| 周期 | 原价 | 折扣 | 实付 | 说明 |
|------|------|------|------|------|
| 1个月 | $29.9 | 0% | $29.9 | 与月付相同 |
| 3个月 | $89.7 | 10% | $80.7 | 适合短期试用 |
| 6个月 | $179.4 | 15% | $152.5 | 半年优惠 |
| 12个月 | $358.8 | 20% | $287.0 | 与年付优惠一致 |

**定价策略：**
- 1个月：无优惠，与月付价格相同
- 3个月：10% 优惠
- 6个月：15% 优惠
- 12个月：20% 优惠（与年付一致）

---

## 🗄️ 数据库设计

### 方案 A：最小改动（推荐）

#### 1. 扩展 `billingInterval` 字段

```typescript
// 当前
billingInterval: 'month' | 'year'

// 扩展后
billingInterval: 'month' | 'year' | 'onetime_1m' | 'onetime_3m' | 'onetime_6m' | 'onetime_12m'
```

**优点：**
- 改动最小
- 向后兼容
- 不需要数据库迁移

**缺点：**
- 语义不够清晰
- 扩展性稍差

---

### 方案 B：新增字段（更清晰）

#### 1. 新增 `subscriptionType` 字段

```sql
-- user_extensions 表
ALTER TABLE user_extensions
ADD COLUMN subscription_type TEXT CHECK (subscription_type IN ('recurring', 'onetime')) DEFAULT 'recurring';

-- user_subscription_history 表
ALTER TABLE user_subscription_history
ADD COLUMN subscription_type TEXT CHECK (subscription_type IN ('recurring', 'onetime')) DEFAULT 'recurring';
```

#### 2. 新增 `duration_months` 字段（仅用于一次性付费）

```sql
-- user_extensions 表
ALTER TABLE user_extensions
ADD COLUMN duration_months INTEGER;

-- user_subscription_history 表
ALTER TABLE user_subscription_history
ADD COLUMN duration_months INTEGER;
```

#### 3. 数据含义

**订阅模式（recurring）：**
- `subscriptionType`: 'recurring'
- `billingInterval`: 'month' | 'year'
- `duration_months`: NULL

**一次性付费（onetime）：**
- `subscriptionType`: 'onetime'
- `billingInterval`: NULL 或 'onetime'
- `duration_months`: 1 | 3 | 6 | 12

**优点：**
- 语义清晰
- 扩展性好
- 易于理解

**缺点：**
- 需要数据库迁移
- 改动较大

---

## 💻 前端UI设计

### 1. Tab 切换器

```
┌─────────────────────────────────────────────────────────┐
│ [ 年付费 优惠23% ] [ 月付费 ] [ 一次性付费 💰 ✅ ]    │
└─────────────────────────────────────────────────────────┘
```

### 2. 一次性付费卡片布局

```
┌───────────────────────────────────────────────┐
│  ⚡ 进阶版                                     │
│  适合每天使用 Agent 的专业人士                │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ $ 238.8 / 一年  优惠 20%          [  v ] │ │  <- 下拉选择器
│  └──────────────────────────────────────────┘ │
│                                                │
│  $ 12.9 / 一个月                              │
│  $ 38.7 / 三个月  优惠 10%                    │
│  $ 77.4 / 六个月  优惠 15%                    │
│  $ 238.8 / 一年   优惠 20%                    │
│                                                │
│  支持银行卡 / 支付宝 / 微信支付  💰 ✅        │
│                                                │
│  [ 开始使用 ]                                 │
│                                                │
│  计算积分 ⓘ                                    │
│  15,000,000 / 每月                             │
└───────────────────────────────────────────────┘
```

### 3. 下拉选择器选项

```typescript
const onetimeOptions = [
  {
    label: '一个月',
    value: '1m',
    price: monthlyPrice,
    discount: 0,
    originalPrice: monthlyPrice,
  },
  {
    label: '三个月 优惠10%',
    value: '3m',
    price: monthlyPrice * 3 * 0.9,
    discount: 10,
    originalPrice: monthlyPrice * 3,
  },
  {
    label: '六个月 优惠15%',
    value: '6m',
    price: monthlyPrice * 6 * 0.85,
    discount: 15,
    originalPrice: monthlyPrice * 6,
  },
  {
    label: '一年 优惠20%',
    value: '12m',
    price: monthlyPrice * 12 * 0.8,
    discount: 20,
    originalPrice: monthlyPrice * 12,
  },
];
```

---

## 🔧 技术实现

### 1. 修复当前方案判断逻辑

#### 当前代码（错误）

```typescript
// src/app/[variants]/(main)/subscription/plans/features/PlanCard.tsx
const isCurrentPlan = currentPlanSlug === plan.slug;
```

#### 修复后的代码

```typescript
const isCurrentPlan =
  currentPlanSlug === plan.slug &&
  currentPlan?.billingInterval === billingCycle;
```

或者更完整的判断（如果采用方案 B）：

```typescript
const isCurrentPlan = useMemo(() => {
  if (!currentPlan || currentPlanSlug !== plan.slug) return false;

  // 订阅模式
  if (currentPlan.subscriptionType === 'recurring') {
    return currentPlan.billingInterval === billingCycle;
  }

  // 一次性付费模式
  if (currentPlan.subscriptionType === 'onetime') {
    return billingCycle === 'onetime' &&
           currentPlan.durationMonths === selectedDuration;
  }

  return false;
}, [currentPlan, currentPlanSlug, plan.slug, billingCycle, selectedDuration]);
```

---

### 2. 新增 BillingCycle 类型

```typescript
// 当前
export type BillingCycle = 'monthly' | 'yearly';

// 扩展后
export type BillingCycle = 'monthly' | 'yearly' | 'onetime';

// 一次性付费周期
export type OnetimeDuration = '1m' | '3m' | '6m' | '12m';
```

---

### 3. Client.tsx 改造

```typescript
const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
const [onetimeDuration, setOnetimeDuration] = useState<OnetimeDuration>('12m');

// 三个 Tab 切换器
<Segmented
  value={billingCycle}
  onChange={setBillingCycle}
  options={[
    { label: '年付费 优惠23%', value: 'yearly' },
    { label: '月付费', value: 'monthly' },
    {
      label: (
        <Flexbox horizontal align="center" gap={4}>
          <span>一次性付费</span>
          <AlipayOutlined />
          <WechatOutlined />
        </Flexbox>
      ),
      value: 'onetime'
    },
  ]}
/>

// 根据 billingCycle 渲染不同的卡片
{billingCycle === 'onetime' ? (
  <OnetimePlanCards
    plans={individualPlans}
    duration={onetimeDuration}
    onDurationChange={setOnetimeDuration}
  />
) : (
  <RegularPlanCards
    plans={individualPlans}
    billingCycle={billingCycle}
  />
)}
```

---

### 4. OnetimePlanCard 组件

新建 `OnetimePlanCard.tsx`：

```typescript
interface OnetimePlanCardProps {
  plan: PlanData;
  duration: OnetimeDuration;
  onDurationChange: (duration: OnetimeDuration) => void;
}

const OnetimePlanCard: FC<OnetimePlanCardProps> = ({
  plan,
  duration,
  onDurationChange
}) => {
  const options = useMemo(() => {
    const monthlyPrice = plan.monthlyPrice;

    return [
      {
        label: '一个月',
        value: '1m',
        months: 1,
        price: monthlyPrice,
        discount: 0,
      },
      {
        label: '三个月 优惠10%',
        value: '3m',
        months: 3,
        price: Math.round(monthlyPrice * 3 * 0.9),
        discount: 10,
      },
      {
        label: '六个月 优惠15%',
        value: '6m',
        months: 6,
        price: Math.round(monthlyPrice * 6 * 0.85),
        discount: 15,
      },
      {
        label: '一年 优惠20%',
        value: '12m',
        months: 12,
        price: Math.round(monthlyPrice * 12 * 0.8),
        discount: 20,
      },
    ];
  }, [plan.monthlyPrice]);

  const currentOption = options.find(o => o.value === duration);

  return (
    <Flexbox className={styles.card}>
      {/* 卡片头部 */}
      <Flexbox className={styles.cardHeader} gap={16}>
        {/* 方案图标和名称 */}

        {/* 下拉选择器 */}
        <Select
          value={duration}
          onChange={onDurationChange}
          options={options}
          style={{ width: '100%' }}
        />

        {/* 价格列表 */}
        <Flexbox gap={8}>
          {options.map(option => (
            <Flexbox
              key={option.value}
              horizontal
              justify="space-between"
              align="center"
            >
              <span>¥{option.price} / {option.label}</span>
              {option.discount > 0 && (
                <Tag color="blue">优惠 {option.discount}%</Tag>
              )}
            </Flexbox>
          ))}
        </Flexbox>

        {/* 支付方式图标 */}
        <Flexbox horizontal gap={8} align="center">
          <span>支持银行卡 / 支付宝 / 微信支付</span>
          <AlipayOutlined />
          <WechatOutlined />
        </Flexbox>

        {/* 购买按钮 */}
        <Button
          type="primary"
          block
          onClick={() => handlePurchase(plan.id, duration)}
        >
          开始使用
        </Button>
      </Flexbox>

      {/* 卡片内容：特性列表 */}
      <Flexbox className={styles.cardBody} gap={16}>
        {/* ... 特性列表 ... */}
      </Flexbox>
    </Flexbox>
  );
};
```

---

### 5. 后端 API 改造

#### tRPC 路由更新

```typescript
// src/server/routers/lambda/payment.ts

createOrder: paymentProcedure
  .input(
    z.object({
      planId: z.string(),
      interval: z.enum(['month', 'year']).optional(),
      subscriptionType: z.enum(['recurring', 'onetime']).default('recurring'),
      durationMonths: z.number().optional(), // 1, 3, 6, 12
      payChannel: z.enum(['wechat_native', 'alipay_precreate']).default('alipay_precreate'),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // 验证逻辑
    if (input.subscriptionType === 'recurring' && !input.interval) {
      throw new Error('interval is required for recurring subscription');
    }
    if (input.subscriptionType === 'onetime' && !input.durationMonths) {
      throw new Error('durationMonths is required for onetime payment');
    }

    // 计算金额
    let amount: number;
    if (input.subscriptionType === 'recurring') {
      amount = input.interval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
    } else {
      // 一次性付费折扣计算
      const discounts = { 1: 1.0, 3: 0.9, 6: 0.85, 12: 0.8 };
      const discount = discounts[input.durationMonths] || 1.0;
      amount = Math.round(plan.monthlyPrice * input.durationMonths * discount);
    }

    // 创建订单...
  });
```

---

## 📊 数据库迁移脚本

### 方案 B 的迁移 SQL

```sql
-- 1. 添加新字段
ALTER TABLE user_extensions
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'recurring',
ADD COLUMN IF NOT EXISTS duration_months INTEGER;

ALTER TABLE user_subscription_history
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'recurring',
ADD COLUMN IF NOT EXISTS duration_months INTEGER;

-- 2. 添加约束
ALTER TABLE user_extensions
ADD CONSTRAINT check_subscription_type
CHECK (subscription_type IN ('recurring', 'onetime'));

ALTER TABLE user_subscription_history
ADD CONSTRAINT check_subscription_type
CHECK (subscription_type IN ('recurring', 'onetime'));

-- 3. 添加注释
COMMENT ON COLUMN user_extensions.subscription_type IS '订阅类型: recurring=订阅模式, onetime=一次性付费';
COMMENT ON COLUMN user_extensions.duration_months IS '一次性付费的月数 (1, 3, 6, 12), 仅在 subscription_type=onetime 时使用';

-- 4. 迁移现有数据（所有现有用户都是订阅模式）
UPDATE user_extensions SET subscription_type = 'recurring' WHERE subscription_type IS NULL;
UPDATE user_subscription_history SET subscription_type = 'recurring' WHERE subscription_type IS NULL;
```

---

## 🧪 测试计划

### 1. 功能测试

- [ ] 月付 Tab 显示正确
- [ ] 年付 Tab 显示正确
- [ ] 一次性付费 Tab 显示正确
- [ ] 下拉选择器切换价格正确
- [ ] 当前方案判断正确
  - [ ] 月付用户在月付 Tab 显示"我的订阅"
  - [ ] 月付用户在年付 Tab 不显示"我的订阅"
  - [ ] 年付用户在年付 Tab 显示"我的订阅"
  - [ ] 一次性付费用户在对应 Tab 和周期显示"我的订阅"

### 2. 支付测试

- [ ] 一次性付费 1 个月支付成功
- [ ] 一次性付费 3 个月支付成功
- [ ] 一次性付费 6 个月支付成功
- [ ] 一次性付费 12 个月支付成功
- [ ] 支付成功后订阅状态正确
- [ ] 支付成功后积分发放正确
- [ ] 到期时间计算正确

### 3. 边界测试

- [ ] 一次性付费到期后不自动续费
- [ ] 用户可以从一次性付费升级到订阅模式
- [ ] 用户可以从订阅模式切换到一次性付费
- [ ] 价格计算精度正确（避免浮点数问题）

---

## 📅 实施计划

### 阶段 1：修复现有问题（1-2小时）

- [x] 修复当前方案判断逻辑
- [x] 添加 `billingInterval` 判断
- [x] 测试月付/年付 Tab 切换

### 阶段 2：数据库设计（2-3小时）

- [ ] 选择方案（A 或 B）
- [ ] 编写迁移脚本
- [ ] 执行数据库迁移
- [ ] 测试数据迁移

### 阶段 3：后端开发（3-4小时）

- [ ] 更新类型定义
- [ ] 更新 tRPC 路由
- [ ] 更新支付回调逻辑
- [ ] 添加价格计算逻辑
- [ ] 单元测试

### 阶段 4：前端开发（4-6小时）

- [ ] 添加一次性付费 Tab
- [ ] 创建 OnetimePlanCard 组件
- [ ] 实现下拉选择器
- [ ] 实现价格列表
- [ ] 连接支付流程
- [ ] UI 调整和美化

### 阶段 5：测试和优化（2-3小时）

- [ ] 功能测试
- [ ] 支付测试
- [ ] 边界测试
- [ ] Bug 修复
- [ ] 性能优化

**总计：12-18 小时**

---

## 🎯 快速开始（先修复现有问题）

### 第一步：修复当前方案判断

只需修改一个文件即可快速修复当前问题：

```typescript
// src/app/[variants]/(main)/subscription/plans/features/PlanCard.tsx

// 修改前
const isCurrentPlan = currentPlanSlug === plan.slug;

// 修改后
const isCurrentPlan = useMemo(() => {
  if (!currentPlan || currentPlanSlug !== plan.slug) return false;

  // 比较计费周期
  const currentInterval = currentPlan.billingInterval;
  const targetInterval = billingCycle === 'yearly' ? 'year' : 'month';

  return currentInterval === targetInterval;
}, [currentPlan, currentPlanSlug, plan.slug, billingCycle]);
```

这样就能立即修复"月付用户在年付 Tab 显示为当前方案"的问题！

---

## 💡 建议

### 短期方案（本周完成）

1. **优先修复现有问题**（1小时）
   - 修复当前方案判断逻辑
   - 立即可用，无需迁移

2. **使用方案 A**（6-8小时）
   - 改动最小
   - 无需数据库迁移
   - 快速上线

### 长期方案（下周完成）

1. **采用方案 B**（12-18小时）
   - 数据结构更清晰
   - 扩展性更好
   - 易于维护

---

**文档结束**

有任何问题，随时讨论！
