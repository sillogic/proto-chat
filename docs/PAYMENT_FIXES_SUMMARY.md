# 支付系统全面修复总结

本文档总结了2026年2月5日对支付系统进行的全面修复和优化。

## 修复的问题

### 1. ✅ 支付金额不一致（用户扫码金额错误）

**问题描述：**
- 前端显示的金额正确（已扣除残值和优惠）
- 但用户扫码后看到的金额是原价（未扣除）
- 例如：页面显示实付600元，但扫码后看到800元

**根本原因：**
- 前端计算了正确的金额（原价 - 优惠 - 残值）
- 但后端 `createOrder` 完全基于 `planId` 查询原价
- 忽略了前端传递的折扣参数

**解决方案：**
- 修改后端接口，接收 `residualValue` 和 `discountAmount` 参数
- 修改 `PaymentService.createOrder` 方法，应用折扣计算
- 前端传递折扣信息给后端
- **结果：** 生成的支付二维码金额与页面显示一致

**相关文件：**
- `src/server/modules/payment/types.ts` - 添加折扣参数
- `src/server/modules/payment/index.ts` - 应用折扣计算
- `src/server/routers/lambda/payment.ts` - 接收折扣参数
- `src/features/Payment/UpgradePaymentModal.tsx` - 传递折扣参数

---

### 2. ✅ 残值计算漏洞（连续升级时残值越算越少）

**问题描述：**
使用 `paidAmount`（实付金额）计算残值，导致连续升级时残值计算错误。

**举例：**
1. 购买方案A：原价480元，优惠80元，**实付400元**
2. 升级到方案B：方案A残值基于实付400元计算（假设200元）
   方案B原价800元，实付600元，**记录 paidAmount = 600元**
3. 升级到方案C：方案B残值基于**实付600元**计算 ❌
   **错误！** 方案B的实际价值是800元，不是600元

**根本原因：**
- 实付金额 = 原价 - 优惠 - 残值（已扣除上一个套餐的残值）
- 用实付金额计算残值，导致价值不断递减

**解决方案：**
引入 `planValue`（套餐标准价值）字段：
- `planValue` = 原价 - 促销优惠（**不扣除残值**） → 用于残值计算
- `paidAmount` = 原价 - 促销优惠 - 残值 → 用户实际支付

**数据库变更：**
- 添加 `payment_orders.plan_value` 字段
- 创建迁移脚本 `migrations/add-plan-value-field.sql`
- 历史数据回填（用 `amount` 作为近似值）

**相关文件：**
- `packages/database/src/schemas/payment.ts` - 添加 planValue 字段
- `src/server/modules/payment/index.ts` - 计算并保存 planValue
- `src/server/modules/payment/types.ts` - 更新接口定义
- `src/server/routers/lambda/subscription.ts` - 返回 planValue
- `src/features/Payment/UpgradePaymentModal.tsx` - 使用 planValue 计算残值

---

### 3. ✅ 后台系统订阅记录金额显示错误

**问题描述：**
- 599元显示为5.99元
- 所有订阅记录的价格都是实际价格的1/100

**根本原因：** 双重除以100
- 后端API：`h.price / 100.0 as price` （已转换为元）
- 前端页面：`(record.price / 100).toFixed(2)` （再次除以100）

**解决方案：**
- 修改后端API，删除 SQL 中的 `/ 100.0`
- 保持返回分为单位，与前端转换逻辑一致
- 添加缺失的 `billingInterval` 字段

**相关文件：**
- `admin-system/server/src/routes/subscriptions.ts` - 修复SQL查询

---

### 4. ✅ 后台系统支付订单优化

**优化内容：**
- 添加"套餐价值"列，显示套餐标准价值
- 计算并显示节省金额（促销优惠 + 残值抵扣）
- 重命名"支付金额"为"实付金额"，更清晰
- 添加 tooltip 说明

**新增展示：**
| 套餐价值 | 实付金额 | 说明 |
|----------|----------|------|
| ¥800.00 | ¥600.00 | 节省 ¥200.00 |
| ¥480.00<br/>省 ¥80.00 | ¥400.00 | 有促销优惠 |

**相关文件：**
- `admin-system/server/src/routes/payments.ts` - 添加 planValue 字段
- `admin-system/src/pages/Payments/Orders/index.tsx` - 优化显示

---

## 数据单位标准化

### 统一规范

所有金额相关字段在**数据库**和**后端API**中统一使用**分（cents）**为单位。

### 为什么使用"分"？

1. **精度保证：** 避免浮点数计算误差
2. **整数运算：** 数据库和后端计算更高效
3. **行业标准：** 微信支付、支付宝都使用分
4. **易于对接：** 与支付渠道API无缝衔接

### 前端展示规则

所有金额在显示时除以100转换为元，格式化为两位小数：
```typescript
¥ {(amount / 100).toFixed(2)}
```

---

## 修复后的完整流程

### 用户升级套餐（一次性付费示例）

**场景：** 用户当前有方案A（原价480元，实付400元），升级到方案B（原价800元）

#### 1. 前端计算

```typescript
// 计算残值（基于 planValue，不是 paidAmount）
const planValue = 480; // 方案A的套餐价值
const residualValue = calculateResidualValue(planValue, ...);
// 假设残值 = 200元

// 计算最终金额
const finalAmount = 800 - 200; // = 600元
```

#### 2. 前端调用后端

```typescript
lambdaClient.payment.createOrder.mutate({
  planId: 'plan_b',
  interval: 'month',
  subscriptionType: 'onetime',
  durationMonths: 3,
  discountAmount: 0, // 无促销优惠
  residualValue: 20000, // 200元 = 20000分
});
```

#### 3. 后端处理

```typescript
// PaymentService.createOrder
const baseAmount = 80000; // 800元（从数据库查询）

// 计算套餐价值（用于将来的残值计算）
const planValue = baseAmount - discountAmount; // 80000 - 0 = 80000分

// 计算实付金额
const amount = baseAmount - discountAmount - residualValue;
// = 80000 - 0 - 20000 = 60000分（600元）

// 保存到数据库
await db.insert(paymentOrders).values({
  amount: 60000,      // 实付金额
  planValue: 80000,   // 套餐价值
  // ...
});
```

#### 4. 生成支付二维码

- 金额：60000分（600元）✅
- 用户扫码看到：**600元** ✅
- 前端显示：**600元** ✅

#### 5. 支付完成后

订单记录：
- `amount`: 60000分（实付金额）
- `planValue`: 80000分（套餐价值，用于将来升级时计算残值）

#### 6. 下次升级

计算残值时使用 `planValue = 80000分`，而不是 `amount = 60000分` ✅

---

## 测试检查清单

### 主项目前端

- [ ] 订阅页面显示的金额正确
- [ ] 升级弹窗显示的套餐价值、残值、优惠、实付金额都正确
- [ ] 支付二维码金额与弹窗显示的实付金额一致
- [ ] 用户扫码后看到的金额与弹窗显示的一致
- [ ] 连续升级3次，每次残值计算都正确

### 后台管理系统

- [ ] 订阅记录页面金额显示正确（599元不显示为5.99元）
- [ ] 支付订单页面新增"套餐价值"列显示正确
- [ ] 支付订单页面"实付金额"显示正确
- [ ] 历史订单（无 planValue）显示"-"，不报错

### 数据库

- [ ] 执行迁移脚本 `add-plan-value-field.sql`
- [ ] 验证 `payment_orders` 表有 `plan_value` 字段
- [ ] 验证历史订单的 `plan_value` 被正确回填

---

## 相关文档

- [残值计算修复详细说明](./RESIDUAL_VALUE_FIX.md)
- [支付金额显示修复详细说明](./PAYMENT_AMOUNT_DISPLAY_FIX.md)
- [后台系统支付页面优化](./ADMIN_SYSTEM_PAYMENT_FIX.md)
- [数据库迁移脚本](../migrations/add-plan-value-field.sql)

---

## 版本信息

- **修复日期：** 2026年2月5日
- **修复人：** Claude Code
- **影响范围：** 主项目、后台管理系统、数据库
- **向下兼容：** 是（历史数据自动回填）

---

## 后续建议

### 1. 数据监控

建议添加数据监控，检测异常情况：
- 实付金额大于套餐价值
- 残值大于套餐价值
- 金额为负数

### 2. 日志记录

建议在订单创建时记录详细日志：
```
订单创建：
- 套餐ID: xxx
- 基础金额: 80000分
- 促销优惠: 0分
- 残值抵扣: 20000分
- 套餐价值: 80000分
- 实付金额: 60000分
```

### 3. 管理后台增强

可以考虑在管理后台添加：
- 残值计算明细查询
- 折扣使用情况统计
- 异常订单预警
