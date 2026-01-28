# 微信委托代扣（订阅自动续费）实现分析

> 基于微信支付 V3 委托代扣文档
> 文档: https://pay.weixin.qq.com/doc/v3/merchant/4012062524

## 一、实现复杂度评估

**结论：中等偏高（相比当前 Native 一次性支付，额外开发量 +60%）**

---

## 二、核心差异分析

### 2.1 当前实现（Native 一次性支付）

```
用户操作：
  点击订阅 → 扫码支付 → 支付成功 ✅

后端流程：
  创建订单 → 等待支付 → 回调发放权益 → [到期后需手动续费]

优点：
  ✅ 简单直接
  ✅ 用户理解成本低
  ✅ 无自动扣款纠纷风险
```

### 2.2 委托代扣（自动续费）

```
首次订阅：
  点击订阅 → 签约+支付（二合一）→ 扫码授权 → 支付成功+签约完成 ✅

自动续费：
  到期前 3 天 → 商户主动发起代扣 → 异步回调 → 成功续期/失败处理

解约：
  用户/商户发起解约 → 到期后停止扣款

优点：
  ✅ 用户体验好（无需每月手动续费）
  ✅ 续费率更高（减少流失）

缺点：
  ❌ 实现复杂度高
  ❌ 扣款失败处理复杂
  ❌ 用户纠纷风险（忘记取消订阅）
```

---

## 三、需要额外实现的功能

### 3.1 数据库设计（新增 2 个表）

#### 签约协议表 `payment_agreements`

```sql
CREATE TABLE payment_agreements (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       VARCHAR(128) UNIQUE NOT NULL,  -- 微信签约协议号
  user_id           TEXT NOT NULL,
  plan_id           TEXT NOT NULL,
  plan_interval     VARCHAR(10) NOT NULL,          -- 'month' | 'year'

  -- 签约信息
  openid            VARCHAR(128),                  -- 用户 openid
  contract_state    VARCHAR(20) NOT NULL,          -- ADD | NORMAL | DELETE
  contract_signed_at TIMESTAMPTZ,

  -- 代扣信息
  next_deduct_date  TIMESTAMPTZ,                   -- 下次扣款日期
  deduct_amount     INTEGER NOT NULL,              -- 每次扣款金额（分）

  -- 状态
  is_active         BOOLEAN DEFAULT TRUE,
  terminated_at     TIMESTAMPTZ,
  terminated_reason TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agreements_user ON payment_agreements(user_id);
CREATE INDEX idx_agreements_contract ON payment_agreements(contract_id);
CREATE INDEX idx_agreements_next_deduct ON payment_agreements(next_deduct_date, is_active);
```

#### 代扣记录表 `payment_transactions`

```sql
CREATE TABLE payment_transactions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       VARCHAR(128) NOT NULL,
  user_id           TEXT NOT NULL,
  order_no          VARCHAR(64) UNIQUE NOT NULL,

  -- 扣款信息
  amount            INTEGER NOT NULL,
  plan_id           TEXT NOT NULL,
  plan_interval     VARCHAR(10) NOT NULL,

  -- 状态
  status            VARCHAR(20) NOT NULL,          -- PROCESSING | SUCCESS | FAIL
  notify_url        TEXT,
  trade_state       VARCHAR(50),                   -- 微信交易状态

  -- 时间
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  failed_reason     TEXT
);
```

#### user_extensions 新增字段

```sql
ALTER TABLE user_extensions ADD COLUMN agreement_id TEXT;  -- 关联签约协议
ALTER TABLE user_extensions ADD COLUMN auto_renew BOOLEAN DEFAULT FALSE;
```

---

### 3.2 签约流程（首次支付时）

#### 新增 API：预签约下单

```typescript
// src/server/modules/payment/channels/wechat-papay.ts

class WeChatPapayChannel extends BasePaymentChannel {
  /**
   * 预签约下单（支付+签约二合一）
   * API: POST /v3/papay/contracts/app-pre-entrust-sign/pay
   */
  async createPresignOrder(params: {
    planName: string;
    amount: number;
    contractDisplayAccount: string;  // 用户昵称/手机号
    outContractCode: string;          // 商户签约协议号
    planId: string;
  }) {
    // 1. 构造签约详情
    const contractInfo = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      out_contract_code: params.outContractCode,
      contract_display_account: params.contractDisplayAccount,
      plan_id: params.planId,  // 模板 ID（需要在微信商户平台创建）
      need_user_confirm: true,
    };

    // 2. 构造支付信息
    const payInfo = {
      description: `订阅 ${params.planName}`,
      out_trade_no: generateOrderNo(),
      amount: {
        total: params.amount,
        currency: 'CNY',
      },
      notify_url: this.config.notifyUrl,
    };

    // 3. 调用微信 API
    const response = await this.wechatV3Request(
      '/v3/papay/contracts/app-pre-entrust-sign/pay',
      {
        contract_information: contractInfo,
        pay_information: payInfo,
      }
    );

    return {
      prepay_id: response.prepay_id,
      contract_id: response.contract_id,
    };
  }
}
```

#### 修改回调处理：同时处理支付+签约

```typescript
// src/app/(backend)/api/payment/wechat/notify/route.ts

// 新增：签约成功回调
export async function POST(request: NextRequest) {
  const eventType = request.headers.get('wechat-event-type');

  if (eventType === 'TRANSACTION.SUCCESS') {
    // 处理支付成功（当前逻辑）
    await handlePaymentSuccess(data);
  } else if (eventType === 'SIGN.NORMAL') {
    // 处理签约成功
    await handleSignSuccess(data);
  }
}

async function handleSignSuccess(data: any) {
  const { contract_id, openid, out_contract_code } = data;

  await serverDB.transaction(async (tx) => {
    // 1. 保存签约协议
    await tx.insert(paymentAgreements).values({
      id: crypto.randomUUID(),
      contractId: contract_id,
      userId: getUserIdFromContractCode(out_contract_code),
      openid,
      contractState: 'NORMAL',
      contractSignedAt: new Date(),
      isActive: true,
      // ...
    });

    // 2. 更新 user_extensions
    await tx.update(userExtensions).set({
      agreementId: contract_id,
      autoRenew: true,
    }).where(/* ... */);
  });
}
```

---

### 3.3 自动扣款流程（续费时）

#### 修改 Cron 任务：到期前发起代扣

```typescript
// src/app/(backend)/api/cron/subscription/route.ts

async function processAutoRenewal() {
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  // 1. 查询 3 天后到期且开启自动续费的用户
  const usersToRenew = await serverDB
    .select()
    .from(userExtensions)
    .leftJoin(paymentAgreements, eq(userExtensions.agreementId, paymentAgreements.contractId))
    .where(
      and(
        lte(userExtensions.planExpiresAt, threeDaysLater),
        eq(userExtensions.autoRenew, true),
        eq(paymentAgreements.isActive, true)
      )
    );

  for (const user of usersToRenew) {
    try {
      // 2. 调用代扣 API
      const result = await wechatPapay.deductPayment({
        contract_id: user.agreement.contractId,
        amount: calculateAmount(user),
        description: '订阅续费',
      });

      // 3. 异步等待回调，或轮询查询结果
      // 注意：代扣是异步的，不会立即返回成功
    } catch (error) {
      console.error('Auto renewal failed:', error);
      // 记录失败，等待用户手动续费
    }
  }
}
```

#### 新增：代扣扣款 API

```typescript
// src/server/modules/payment/channels/wechat-papay.ts

async deductPayment(params: {
  contract_id: string;
  amount: number;
  description: string;
}) {
  // 调用微信委托代扣扣款 API
  // POST /v3/papay/pay-contracts/transactions/apply
  const response = await this.wechatV3Request(
    '/v3/papay/pay-contracts/transactions/apply',
    {
      appid: this.config.appId,
      mchid: this.config.mchId,
      contract_id: params.contract_id,
      out_trade_no: generateOrderNo(),
      description: params.description,
      amount: {
        total: params.amount,
        currency: 'CNY',
      },
      notify_url: this.config.deductNotifyUrl,
    }
  );

  return {
    out_trade_no: response.out_trade_no,
    // 注意：这里不会立即返回支付结果，需要等待异步回调
  };
}
```

#### 代扣回调处理

```typescript
// src/app/(backend)/api/payment/wechat/deduct-notify/route.ts

export async function POST(request: NextRequest) {
  const data = await parseWechatCallback(request);

  if (data.trade_state === 'SUCCESS') {
    // 代扣成功，续期订阅
    await renewSubscription(data);
  } else {
    // 代扣失败（余额不足、签约过期等）
    await handleDeductFailure(data);
  }
}
```

---

### 3.4 解约管理

#### 用户主动解约

```typescript
// src/server/routers/lambda/payment.ts

export const paymentRouter = router({
  // 新增：取消自动续费
  cancelAutoRenew: authedProcedure
    .input(z.object({ agreementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 1. 调用微信解约 API
      await wechatPapay.terminateContract(input.agreementId);

      // 2. 更新数据库
      await serverDB.transaction(async (tx) => {
        await tx.update(paymentAgreements).set({
          isActive: false,
          contractState: 'DELETE',
          terminatedAt: new Date(),
          terminatedReason: 'USER_CANCEL',
        });

        await tx.update(userExtensions).set({
          autoRenew: false,
        });
      });
    }),
});
```

#### 商户解约（扣款失败后）

```typescript
async function handleDeductFailure(data: any) {
  const failCount = await getDeductFailCount(data.contract_id);

  if (failCount >= 3) {
    // 连续失败 3 次，自动解约
    await wechatPapay.terminateContract(data.contract_id);

    await serverDB.update(paymentAgreements).set({
      isActive: false,
      terminatedReason: 'DEDUCT_FAIL_LIMIT',
    });

    // 发送通知：订阅即将到期，请手动续费
  }
}
```

---

## 四、前端改动

### 4.1 订阅页面

```tsx
// PlanCard.tsx

<Checkbox onChange={(e) => setAutoRenew(e.target.checked)}>
  开启自动续费（到期自动扣款）
</Checkbox>

<Alert
  type="info"
  message="自动续费说明"
  description="开启后，订阅到期前将自动从您的微信账户扣款续费。您可随时取消。"
/>
```

### 4.2 个人中心 - 订阅管理

```tsx
// SubscriptionManagement.tsx

<Card title="订阅状态">
  <p>当前方案: Pro 月付</p>
  <p>到期时间: 2026-02-27</p>
  <p>自动续费: 已开启 ✅</p>

  <Button danger onClick={handleCancelAutoRenew}>
    取消自动续费
  </Button>
</Card>

<Modal title="确认取消自动续费？">
  <p>取消后，订阅到期后将不会自动扣款。</p>
  <p>您仍可在到期前手动续费。</p>
</Modal>
```

---

## 五、风险点与对策

### 5.1 扣款失败处理

**风险**：
- 用户余额不足
- 银行卡冻结
- 签约协议过期

**对策**：
```typescript
// 扣款失败策略
if (deductFailed) {
  // 1. 记录失败次数
  incrementFailCount(contract_id);

  // 2. 发送提醒：请充值微信账户
  sendNotification(userId, 'DEDUCT_FAILED');

  // 3. 连续失败 3 次 → 自动解约 + 到期降级
  if (failCount >= 3) {
    terminateContract(contract_id);
    sendNotification(userId, 'AUTO_RENEW_CANCELLED');
  }
}
```

### 5.2 用户投诉风险

**场景**：用户忘记取消订阅，被"意外"扣款

**对策**：
1. **前端强提示**：
   - 订阅时明确显示"开启自动续费"选项
   - 勾选时弹窗二次确认
   - 显眼位置展示扣款日期

2. **到期前提醒**：
   - 扣款前 7 天发送提醒：即将续费
   - 提供一键取消链接

3. **退款政策**：
   - 扣款后 24 小时内可申请退款
   - Admin 后台支持退款操作

### 5.3 异步回调延迟

**风险**：代扣是异步的，回调可能延迟几分钟甚至更久

**对策**：
```typescript
// 1. Cron 提前 3 天发起代扣（留足缓冲时间）
// 2. 轮询查询代扣结果
async function checkDeductResult(out_trade_no: string) {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    const result = await wechatPapay.queryTransaction(out_trade_no);
    if (result.trade_state === 'SUCCESS') {
      await renewSubscription(result);
      return;
    }
    await sleep(30000); // 30 秒后重试
  }
}
```

---

## 六、实现时间评估

### 6.1 开发工作量

| 模块 | 工作量 | 说明 |
|------|--------|------|
| 数据库设计 | 0.5 天 | 2 个新表 + 字段修改 |
| 签约流程 | 1 天 | 预签约下单 + 回调处理 |
| 代扣流程 | 1 天 | 代扣 API + 异步回调 + 轮询 |
| 解约管理 | 0.5 天 | 用户/商户解约 + 失败策略 |
| 前端改造 | 1 天 | 订阅页面 + 个人中心 |
| 测试调试 | 1 天 | 微信沙箱测试 |
| **总计** | **5 天** | 不含微信商户平台配置 |

### 6.2 前置准备

1. **微信商户平台配置**：
   - 开通"委托代扣"产品（需要审核 1-3 个工作日）
   - 创建代扣模板（plan_id）
   - 配置签约回调地址

2. **法律合规**：
   - 起草《自动续费服务协议》
   - 用户协议中明确说明扣款规则

---

## 七、推荐方案

### 方案 A：**渐进式实现（强烈推荐）** ⭐⭐⭐⭐⭐

```
Phase 8.1（已完成）：
  ✅ Native 一次性支付上线
  ✅ 手动续费流程

Phase 8.2（2-3 个月后）：
  🔄 积累用户反馈
  🔄 评估自动续费需求
  🔄 再开发委托代扣
```

**优势**：
- ✅ 快速上线，快速验证产品
- ✅ 降低初期风险（扣款纠纷、技术风险）
- ✅ 用户教育成本低
- ✅ 迭代灵活

**劣势**：
- ❌ 用户需要每月手动续费（流失率可能高 10-20%）

---

### 方案 B：**直接实现委托代扣**

```
立即开发：
  🚀 5 天开发 + 3 天测试
  🚀 2 周内上线完整订阅系统
```

**优势**：
- ✅ 用户体验最佳
- ✅ 续费率更高

**劣势**：
- ❌ 实现复杂度高
- ❌ 前期投入大
- ❌ 风险高（扣款纠纷、技术问题）
- ❌ 微信审核周期不可控

---

## 八、最终建议

**结论：先上线当前的 Native 支付，2-3 个月后再考虑委托代扣**

理由：
1. **MVP 原则**：先验证产品核心价值
2. **风险可控**：避免初期因扣款纠纷影响口碑
3. **迭代灵活**：根据用户反馈决定是否需要自动续费
4. **成本优化**：避免过度开发

---

## 九、技术细节补充

### 9.1 微信 V3 API 签名

委托代扣使用微信支付 V3 API，签名方式与 V2（Native 支付）不同：

```typescript
// V2: MD5 签名
const sign = md5(`key1=value1&key2=value2&key=${API_KEY}`);

// V3: 私钥签名（RSA/Ed25519）
const signature = privateKey.sign(
  `${timestamp}\n${nonce}\n${body}\n`,
  'base64'
);
```

需要额外实现：
- 商户私钥加载
- 微信平台证书验证
- 敏感信息加密（如手机号）

### 9.2 代扣与支付的区别

| 特性 | Native 支付 | 委托代扣 |
|------|------------|---------|
| 发起方 | 用户扫码 | **商户主动** |
| 用户操作 | 每次都要扫码 | 首次签约，后续自动 |
| 回调延迟 | 实时（秒级） | **异步（分钟级）** |
| 失败处理 | 用户重新支付 | 商户重试/解约 |
| 退款 | 简单 | 需考虑签约状态 |

---

## 十、相关文档

- [微信支付 V3 委托代扣](https://pay.weixin.qq.com/doc/v3/merchant/4012062524)
- [预签约下单 API](https://pay.weixin.qq.com/doc/v3/merchant/4012062525)
- [代扣扣款 API](https://pay.weixin.qq.com/doc/v3/merchant/4012062526)
- [解约 API](https://pay.weixin.qq.com/doc/v3/merchant/4012062527)
