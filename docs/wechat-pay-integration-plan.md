# 微信支付接入 & 订阅系统重构 — 实施计划

> 生成时间: 2026-01-27
> 分支: `next`

---

## 目录

1. [改动总览](#1-改动总览)
2. [影响评估](#2-影响评估)
3. [阶段划分与执行顺序](#3-阶段划分与执行顺序)
4. [Phase 1: 数据库 Schema 重构](#phase-1-数据库-schema-重构)
5. [Phase 2: Admin 后台适配](#phase-2-admin-后台适配)
6. [Phase 3: 主项目后端 — 方案查询接口](#phase-3-主项目后端--方案查询接口)
7. [Phase 4: 主项目前端 — 订阅页面动态化](#phase-4-主项目前端--订阅页面动态化)
8. [Phase 5: 支付后端 — 微信支付接入](#phase-5-支付后端--微信支付接入)
9. [Phase 6: 支付前端 — 支付流程 UI](#phase-6-支付前端--支付流程-ui)
10. [Phase 7: 定时任务 — 积分发放与到期处理](#phase-7-定时任务--积分发放与到期处理)
11. [数据迁移方案](#数据迁移方案)
12. [测试计划](#测试计划)

---

## 1. 改动总览

| 模块 | 改动内容 | 风险等级 |
|------|---------|---------|
| DB Schema (`subscription_plans`) | 合并月/年行，去掉 `interval`/`price`，加 `monthly_price`/`yearly_price` 等字段 | **高** — 影响所有读写该表的代码 |
| DB Schema (`user_extensions`) | 新增 `billing_interval`、`next_credit_grant_at` 字段 | **低** — 新增字段，不影响现有逻辑 |
| DB Schema (新表) | 新建 `payment_orders`、`payment_notifications` 表 | **无** — 纯新增 |
| Admin 后台 | 方案管理表单/列表适配新 schema，新增支付管理页 | **中** |
| 主项目后端 | 新增方案查询 tRPC 路由、支付 tRPC 路由、微信回调 API 路由 | **低** — 纯新增 |
| 主项目前端 | 订阅页改为数据库驱动，新增支付弹窗 | **中** |
| 定时任务 | 新增积分发放 + 到期处理 cron | **低** — 纯新增 |

---

## 2. 影响评估

### 2.1 受 `subscription_plans` Schema 变更影响的文件

以下文件直接读写 `subscription_plans` 表，Schema 变更后**必须同步修改**：

| 文件 | 影响点 | 需要改动 |
|------|--------|---------|
| `packages/database/src/schemas/subscription.ts` | 表定义 | 去掉 `interval`/`price`，加 `monthlyPrice`/`yearlyPrice`/`displayOrder`/`isPopular` |
| `admin-system/server/src/db/subscription-schema.ts` | Admin 表定义(镜像) | 同步改动 |
| `admin-system/server/src/services/subscription-service.ts` | CRUD 操作 | 字段名变更，无逻辑变更 |
| `admin-system/server/src/services/usage-service.ts` | **核心** — `executeUpgrade()` (L340)、`processExpirations()` (L468) 读取 `plan.interval` 计算到期时间；`price` 写入 subscription_history | 用 `user_extensions.billing_interval` 替代 `plan.interval`；`price` 改为根据 interval 选 `monthlyPrice` 或 `yearlyPrice` |
| `admin-system/server/src/routes/plans.ts` | REST CRUD | 字段名变更 |
| `admin-system/server/src/routes/subscriptions.ts` | 查询 subscription_history | 无影响（history 表不变） |
| `src/server/services/user/index.ts` | `initUser()` 查询 `slug='free-trial'` 的方案 | 无逻辑影响，free-trial 方案仍然存在，只是字段名变了 |
| `src/server/services/user/usageService.ts` | 查询方案的 `storageLimit`/`vectorLimit` | 这些字段未变，**无影响** |
| `packages/database/src/models/user.ts` | `getUserState()` join subscriptionPlans | 无逻辑影响，只读 name |
| `scripts/seed-subscription.ts` | 种子数据 | 需要重写适配新 schema |
| `scripts/backfill-free-plan.ts` | 回填脚本 | 需要适配新字段 |
| `admin-system/src/pages/Users/index.tsx` | 前端读 plan 列表 | `p.slug` 匹配逻辑不变，但下拉选项展示需适配 |
| `admin-system/src/services/admin.ts` | 调用 upgrade/schedule API | 无影响（传 planId，不传 interval） |

### 2.2 关键风险点

| 风险 | 说明 | 应对措施 |
|------|------|---------|
| `plan.interval` 被移除 | `usage-service.ts` 的 `executeUpgrade()` 和 `processExpirations()` 用 `plan.interval` 决定续期时长 | **改为从 `user_extensions.billing_interval` 读取**。升级时前端/Admin 传入 interval，写入 user_extensions |
| `plan.price` 被移除 | `executeUpgrade()` 将 `targetPlan.price` 写入 subscription_history | 改为根据 `billing_interval` 选择 `monthlyPrice` 或 `yearlyPrice` |
| 数据库已有方案数据 | 现有的 lite-monthly / lite-yearly 等行需要合并 | 编写迁移脚本，见 [数据迁移方案](#数据迁移方案) |
| Admin 后台方案管理 | 表单结构变化 | Phase 2 中同步改造 |
| free-trial / plan_free 方案 | `initUser()` 和 `usage-service.ts` 通过 slug 查询 | slug 不变，**无影响**。free 方案的 `monthlyPrice`/`yearlyPrice` 都设为 0 |

### 2.3 不受影响的模块

| 模块 | 原因 |
|------|------|
| 积分消费逻辑 (`credit/index.ts`) | 只读 `userBalances`，不涉及方案表 |
| 模型定价 (`modelPricings`) | 独立表，不受影响 |
| tRPC 路由 (`usage.ts`, `user.ts`) | 不直接查方案表 |
| 用户认证 (Clerk webhook) | 只触发 `initUser()`，改动已覆盖 |
| 桌面端 / 移动端 | 共享同一套前端代码 |

---

## 3. 阶段划分与执行顺序

```
Phase 1 ─── Schema 重构 + 数据迁移
  │
  ├──→ Phase 2 ─── Admin 后台适配（可与 Phase 3 并行）
  │
  ├──→ Phase 3 ─── 主项目后端：方案查询接口（可与 Phase 2 并行）
  │       │
  │       └──→ Phase 4 ─── 主项目前端：订阅页面动态化
  │
  └──→ Phase 5 ─── 支付后端：微信支付接入（Phase 1 完成即可开始）
          │
          └──→ Phase 6 ─── 支付前端：支付流程 UI（依赖 Phase 4 + 5）

Phase 7 ─── 定时任务（可独立开发，Phase 1 完成后随时开始）
```

**可并行的组合：**
- Phase 2 + Phase 3 + Phase 5 + Phase 7（Phase 1 完成后全部可并行启动）
- Phase 4 等待 Phase 3
- Phase 6 等待 Phase 4 + Phase 5

---

## Phase 1: 数据库 Schema 重构

### 1.1 `subscription_plans` 表改动

**移除字段：**
- `interval` (`plan_interval` enum)
- `price` (`integer`)

**新增字段：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `monthly_price` | `INTEGER NOT NULL` | — | 月付价格（分） |
| `yearly_price` | `INTEGER` | `NULL` | 年付总价（分），NULL = 不支持年付 |
| `display_order` | `INTEGER` | `0` | 前端排序 |
| `is_popular` | `BOOLEAN` | `FALSE` | 推荐标记 |

**`features` JSONB 结构定义：**

```typescript
interface PlanFeatures {
  // 展示用数据
  display: {
    description: string;                       // "适合个人轻度使用"
    support_level: 'community' | 'priority_email' | 'dedicated';
    model_estimates: Array<{                   // 模型估算对话数
      model: string;                           // "GPT-5 mini"
      count: string;                           // "约 7,000 条"
    }>;
    vector_storage_display: string;            // "≈ 50MB"
  };
  // 功能开关（影响业务权限判断 + 前端展示）
  capabilities: {
    custom_api: boolean;
    unlimited_messages: boolean;
    unlimited_history: boolean;
    global_sync: boolean;
    agent_market: boolean;
    premium_plugins: boolean;
    web_search: boolean;
    file_upload: boolean;
    tts: boolean;
    // 未来可扩展...
  };
}
```

### 1.2 `user_extensions` 表新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `billing_interval` | `TEXT` | `NULL` | 当前计费周期 `'month'` \| `'year'`，free 用户为 NULL |
| `next_credit_grant_at` | `TIMESTAMPTZ` | `NULL` | 下次积分发放时间 |

### 1.3 新建 `payment_orders` 表

```sql
CREATE TABLE payment_orders (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no          VARCHAR(64) UNIQUE NOT NULL,
  user_id           TEXT NOT NULL,

  -- 订单内容
  plan_id           TEXT NOT NULL,
  plan_interval     VARCHAR(10) NOT NULL,          -- 'month' | 'year'
  amount            INTEGER NOT NULL,              -- 支付金额(分)
  currency          VARCHAR(10) DEFAULT 'CNY',

  -- 支付渠道
  pay_channel       VARCHAR(20) NOT NULL,          -- 'wechat_native' | 'alipay' | ...
  channel_order_no  VARCHAR(128),                  -- 渠道方订单号

  -- 状态
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending | paid | closed | refunded
  channel_data      JSONB,                         -- 渠道特有数据(code_url等)

  -- 时间
  expired_at        TIMESTAMPTZ NOT NULL,
  paid_at           TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.4 新建 `payment_notifications` 表

```sql
CREATE TABLE payment_notifications (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no          VARCHAR(64) NOT NULL,
  pay_channel       VARCHAR(20) NOT NULL,
  raw_data          TEXT NOT NULL,
  status            VARCHAR(20) NOT NULL,          -- success | fail | duplicate
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.5 `user_subscription_history` 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `order_no` | `VARCHAR(64)` | 关联 payment_orders，admin 可追溯支付记录 |
| `billing_interval` | `TEXT` | 记录该笔订阅的计费周期 |

### 1.6 需要修改的文件清单

| 文件 | 操作 |
|------|------|
| `packages/database/src/schemas/subscription.ts` | 重构表定义 |
| `admin-system/server/src/db/subscription-schema.ts` | 同步镜像 |
| `packages/database/src/schemas/userExtension.ts` | 加 2 个字段 |
| `admin-system/server/src/db/user-extensions-schema.ts` | 同步镜像 |
| DB migration 脚本 | 新建，见 [数据迁移方案](#数据迁移方案) |
| `scripts/seed-subscription.ts` | 适配新 schema |
| `scripts/backfill-free-plan.ts` | 适配新字段 |

---

## Phase 2: Admin 后台适配

### 2.1 后端改动

| 文件 | 改动 |
|------|------|
| `admin-system/server/src/services/subscription-service.ts` | 字段名适配 (`price` → `monthlyPrice`/`yearlyPrice` 等) |
| `admin-system/server/src/services/usage-service.ts` | **核心改动**：`executeUpgrade()` 和 `processExpirations()` 中用 `billing_interval` 替代 `plan.interval`；写 history 时根据 interval 选价格 |
| `admin-system/server/src/routes/plans.ts` | 字段名适配 |
| `admin-system/server/src/routes/users-simplified.ts` | 升级接口增加 `billingInterval` 参数 |

**`executeUpgrade()` 改造要点：**

```typescript
// 之前：从方案表读 interval
if (targetPlan.interval === 'year') { ... }

// 之后：从参数/user_extensions 读 billing_interval
async executeUpgrade(userId: string, targetPlanId: string, billingInterval: 'month' | 'year', customCategory?: string) {
  // ...
  const expiresAt = new Date(now);
  if (billingInterval === 'year') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  // 写入 user_extensions 时同时写入 billing_interval 和 next_credit_grant_at
  await tx.insert(userExtensions).values({
    billingInterval,
    nextCreditGrantAt: nextMonth(now),  // 首次积分发放 = 1个月后
    // ...其他字段
  });

  // 写 history 时根据 interval 选价格
  const price = billingInterval === 'year' ? targetPlan.yearlyPrice : targetPlan.monthlyPrice;
  await tx.insert(userSubscriptionHistory).values({
    price,
    billingInterval,
    // ...
  });
}
```

**`processExpirations()` 改造要点：**

```typescript
// 之前：从方案表读 interval
if (plan.interval === 'year') nextExpires.setFullYear(...);

// 之后：从 user_extensions 读 billing_interval
if (userExt.billingInterval === 'year') nextExpires.setFullYear(...);
```

### 2.2 前端改动

| 文件/页面 | 改动 |
|----------|------|
| 方案管理列表页 | 一个方案一行（不再月/年分行），显示月价+年价两列 |
| 方案编辑表单 | 价格区：月付价格 + 年付价格（为空=不支持年付） |
| 方案编辑表单 | 新增：排序、推荐标记、描述 |
| 方案编辑表单 | 新增 features 编辑区：模型估算（动态增删行）、功能开关（checkbox 组）、技术支持级别（下拉） |
| 用户管理 - 升级弹窗 | 选择方案后需额外选择计费周期（月/年） |
| **新增** 支付管理页 | 订单列表、订单详情、统计看板 |

### 2.3 新增 Admin 支付管理路由

| 端点 | 作用 |
|------|------|
| `GET /payments/orders` | 分页查询订单（筛选：用户/状态/渠道/时间） |
| `GET /payments/orders/:id` | 订单详情 + 关联的通知日志 |
| `GET /payments/statistics` | 支付统计（日/月收入、成功率） |

---

## Phase 3: 主项目后端 — 方案查询接口

### 3.1 新增 tRPC 路由

文件：`src/server/routers/lambda/subscription.ts`

| 路由 | 认证 | 说明 |
|------|------|------|
| `subscription.getPlans` | 公开 | 返回所有 `is_active=true` 的方案，按 `display_order` 排序 |
| `subscription.getCurrentPlan` | 需登录 | 返回当前用户的订阅状态 |

**`getPlans` 返回结构：**

```typescript
interface PlanResponse {
  id: string;
  name: string;
  slug: string;
  type: 'individual' | 'team';
  monthlyPrice: number;       // 分
  yearlyPrice: number | null;  // 分, null=不支持年付
  credits: string;
  storageLimit: number;
  vectorLimit: number;
  features: PlanFeatures;      // 完整 features JSONB
  isPopular: boolean;
  displayOrder: number;
}
```

### 3.2 注册路由

文件：`src/server/routers/lambda/index.ts` — 注册 `subscription` 路由

---

## Phase 4: 主项目前端 — 订阅页面动态化

### 4.1 改造 `useSubscriptionPlans` Hook

文件：`src/app/[variants]/(main)/subscription/hooks/useSubscriptionPlans.ts`

- 删除所有硬编码方案数据
- 改为调用 `trpc.subscription.getPlans` 获取方案列表
- 重新定义 `PlanData` 接口对齐后端返回结构

### 4.2 改造 `PlanCard` 组件

文件：`src/app/[variants]/(main)/subscription/plans/features/PlanCard.tsx`

- Props 对齐新 `PlanData`
- 从 `features.display` 读取描述、支持级别等
- 从 `features.display.model_estimates` 动态渲染模型估算
- 从 `features.capabilities` 渲染功能列表
- 年付优惠展示：`monthlyPrice * 12 > yearlyPrice` 时显示优惠标签
- `yearlyPrice === null` 时隐藏年付选项

### 4.3 改造 `ComparisonTable` 组件

文件：`src/app/[variants]/(main)/subscription/plans/features/ComparisonTable.tsx`

- 删除硬编码的 `features` 数组
- 从方案数据动态构建对比表：
  - 计算资源区：从 `credits` + `features.display.model_estimates`
  - 存储空间区：从 `storageLimit` + `vectorLimit` + `features.display.vector_storage_display`
  - 功能区：从 `features.capabilities` 动态生成行
  - 服务支持区：从 `features.display.support_level`

### 4.4 改造 `Client.tsx`

文件：`src/app/[variants]/(main)/subscription/plans/Client.tsx`

- 加载状态处理（Skeleton）
- 错误状态处理

---

## Phase 5: 支付后端 — 微信支付接入

### 5.1 支付渠道抽象层

```
src/server/modules/payment/
├── index.ts                    # PaymentService 统一入口
├── types.ts                    # 接口定义
├── channels/
│   ├── base.ts                 # PaymentChannel 抽象接口
│   └── wechat-native.ts        # 微信 Native 支付实现
└── utils/
    └── order-no.ts             # 订单号生成 (如 PC + 时间戳 + 随机数)
```

**PaymentChannel 接口：**

```typescript
interface PaymentChannel {
  createPayment(order: PaymentOrder): Promise<ChannelPaymentResult>;
  parseNotification(rawBody: string | Buffer): Promise<NotificationResult>;
  queryOrder(orderNo: string): Promise<OrderStatus>;
  closeOrder(orderNo: string): Promise<void>;
}
```

### 5.2 微信 Native 支付实现

- 调用统一下单 API: `POST https://api.mch.weixin.qq.com/pay/unifiedorder`
- `trade_type=NATIVE`
- XML 格式通信
- 签名：MD5 或 HMAC-SHA256
- 返回 `code_url` 供前端生成二维码

### 5.3 tRPC 支付路由

文件：`src/server/routers/lambda/payment.ts`

| 路由 | 说明 |
|------|------|
| `payment.createOrder` | 入参: `planId` + `interval`（月/年），后端查表确定金额，调用微信下单，返回 `orderNo` + `codeUrl` |
| `payment.queryOrder` | 入参: `orderNo`，返回订单状态 |
| `payment.closeOrder` | 入参: `orderNo`，关闭未支付订单 |

**`createOrder` 流程：**

```
1. 校验用户已登录
2. 根据 planId 查 subscription_plans
3. 根据 interval 取 monthlyPrice 或 yearlyPrice（后端决定金额，不信任前端）
4. 检查是否有同方案的 pending 订单（有则复用，避免重复下单）
5. 生成订单号，写入 payment_orders (status=pending)
6. 调用微信统一下单 API
7. 将 code_url 存入 channel_data
8. 返回 { orderNo, codeUrl, expiredAt }
```

### 5.4 微信回调路由

文件：`src/app/(backend)/api/payment/wechat/notify/route.ts`

- HTTP POST（非 tRPC）
- 返回 XML 格式

**回调处理流程：**

```
1. 解析 XML，验证签名
2. 根据 out_trade_no 查 payment_orders
3. 幂等检查：已 paid 则直接返回 SUCCESS
4. 如果 result_code === 'SUCCESS':
   a. 更新 payment_orders: status=paid, paid_at, channel_order_no
   b. 更新 user_extensions: currentPlan, planId, planExpiresAt, billingInterval, nextCreditGrantAt
   c. 写入 user_subscription_history
   d. 发放积分 → user_balances + user_transactions (SUBSCRIPTION_GRANT)
5. 写入 payment_notifications 日志
6. 返回 <xml><return_code>SUCCESS</return_code></xml>
```

### 5.5 环境变量

```env
WECHAT_PAY_APP_ID=wx...
WECHAT_PAY_MCH_ID=16...
WECHAT_PAY_API_KEY=...
WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify
```

---

## Phase 6: 支付前端 — 支付流程 UI

### 6.1 支付弹窗组件

文件：`src/features/Payment/PaymentModal.tsx`

```
┌──────────────────────────────┐
│   订阅 Pro 方案 · ¥299/月     │
│                              │
│       ┌────────────┐         │
│       │  QR Code   │         │
│       └────────────┘         │
│                              │
│   请使用微信扫码支付            │
│   有效期: 29:58              │
│                              │
│   [ 取消支付 ]                │
└──────────────────────────────┘
```

- 使用 `qrcode.react` 将 `code_url` 渲染为二维码
- 2 小时倒计时
- 取消按钮调用 `payment.closeOrder`

### 6.2 轮询逻辑

```typescript
// 每 3 秒轮询
const poll = setInterval(async () => {
  const result = await trpc.payment.queryOrder.query({ orderNo });

  if (result.status === 'paid') {
    clearInterval(poll);
    await userStore.refreshUserState();  // 刷新订阅状态
    showSuccessPage();
  }

  if (result.status === 'closed') {
    clearInterval(poll);
    showExpiredMessage();
  }
}, 3000);

// 组件卸载 / 弹窗关闭时
cleanup = () => {
  clearInterval(poll);
  if (order.status === 'pending') {
    trpc.payment.closeOrder.mutate({ orderNo });
  }
};
```

### 6.3 未支付处理

- 关闭弹窗 → 调用 `closeOrder` 关闭微信订单
- 再次点击订阅同一方案 → 检查是否有未过期的 pending 订单 → 有则复用（恢复二维码 + 轮询），无则创建新订单
- 订单超过 `expired_at` → 前端展示"二维码已过期，请重新发起"

### 6.4 改造 PlanCard 订阅按钮

文件：`src/app/[variants]/(main)/subscription/plans/features/PlanCard.tsx`

- `onUpgrade(planId)` → `onUpgrade(planId, billingCycle)` 传入计费周期
- 点击后打开 PaymentModal

---

## Phase 7: 定时任务 — 积分发放与到期处理

### 7.1 实现方式

文件：`src/app/(backend)/api/cron/subscription/route.ts`

使用 Next.js Route Handler + Vercel Cron 或外部 cron 触发（每日 00:05）。

需配置 cron secret 校验，防止外部调用。

### 7.2 积分发放逻辑

```
查询: WHERE next_credit_grant_at <= NOW()
        AND is_suspended = false
        AND current_plan != 'free'

对每个命中用户（批量处理）:
  1. 查关联的 subscription_plans.credits
  2. 写入 user_balances (重置余额为方案积分)
  3. 写入 user_transactions (type=SUBSCRIPTION_GRANT, category=MONTHLY_GRANT)
  4. 更新 next_credit_grant_at += 1 month
```

**注意：月付和年付用户走完全相同的积分发放逻辑，每月一次。**

### 7.3 到期处理逻辑

```
查询: WHERE plan_expires_at <= NOW()
        AND current_plan != 'free'

对每个命中用户:
  Case A: auto_renew = true (未来自动扣款，当前阶段视为过期)
    → 标记为过期（后续接入自动续费后改造）

  Case B: auto_renew = false 或扣款失败
    → current_plan = 'free'
    → planId = free 方案 ID
    → billing_interval = NULL
    → next_credit_grant_at = NULL
    → 写 subscription_history (status=expired)
```

### 7.4 即将到期提醒（可选，后续迭代）

```
查询: WHERE plan_expires_at BETWEEN NOW() AND NOW() + 7 days
        AND current_plan != 'free'
→ 发送提醒通知（站内信/邮件）
```

---

## 数据迁移方案

### 迁移脚本逻辑

针对已有的"月/年并列行"数据：

```
1. 查找所有 name 相同但 interval 不同的行对
   例: (Lite Monthly, month, 14900) + (Lite Yearly, year, 143040)

2. 合并为一行:
   name = 'Lite'
   slug = 'lite' (去掉 -monthly/-yearly 后缀)
   monthly_price = 14900
   yearly_price = 143040
   (credits/storageLimit/vectorLimit/features 取 month 行的值)

3. 更新 user_extensions 中引用旧 planId 的记录指向合并后的 planId

4. 更新 user_subscription_history 中引用旧 planId 的记录

5. 删除多余的行

6. 对 free-trial / plan_free 方案:
   monthly_price = 0
   yearly_price = NULL
```

### 迁移步骤

```bash
# 1. 生成 migration
bun run db:generate

# 2. 在测试环境执行迁移
bun run db:migrate

# 3. 执行数据迁移脚本
bunx tsx scripts/migrate-plans.ts

# 4. 验证数据完整性
bunx tsx scripts/verify-migration.ts
```

---

## 测试计划

### Phase 1 测试

- [ ] Schema migration 正常执行
- [ ] 数据迁移脚本正确合并方案行
- [ ] 已有用户的 planId 引用未断裂
- [ ] `initUser()` 仍能正确初始化 free 用户

### Phase 2 测试

- [ ] Admin 方案 CRUD 正常
- [ ] Admin 用户升级（含选择计费周期）正常
- [ ] Admin 到期模拟正常
- [ ] Admin 支付管理页数据展示正确

### Phase 3-4 测试

- [ ] `subscription.getPlans` 返回正确的方案列表
- [ ] 前端订阅页渲染数据库方案（非硬编码）
- [ ] 年付/月付切换展示正确
- [ ] 年付价格为 NULL 时隐藏年付选项
- [ ] 对比表动态渲染正确

### Phase 5-6 测试

- [ ] 创建订单 → 微信下单成功 → 返回 code_url
- [ ] 扫码支付 → 回调通知 → 订单状态更新 → 订阅生效
- [ ] 轮询检测到支付成功 → UI 刷新 → 展示新订阅
- [ ] 未支付关闭弹窗 → 订单关闭
- [ ] 同方案重复点击 → 复用未过期 pending 订单
- [ ] 订单过期 → 提示重新发起
- [ ] 回调幂等（重复通知不重复发放）
- [ ] 签名验证失败 → 拒绝处理

### Phase 7 测试

- [ ] 积分按月发放（月付和年付用户均正确）
- [ ] 到期用户降级为 free
- [ ] 未到期用户不受影响
- [ ] next_credit_grant_at 正确递增
