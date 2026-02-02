# 订阅方案 ID 优化方案

**创建日期：** 2026-01-30

---

## 问题背景

当前订阅方案表 `subscription_plans` 中存在以下方案 ID：
- `plan_ultra_mo` - Ultra 月付方案
- `plan_lite_mo` - Lite 月付方案
- `plan_pro_mo` - Pro 月付方案
- `plan_free` - Free 方案

这些 ID 中的 `_mo` 后缀来自早期设计（区分月付/年付独立方案），但现在架构已改进为统一方案支持月付和年付。

### 问题

1. **命名不一致**：保留了 `_mo` 后缀，与当前架构不符
2. **订单信息显示不友好**：支付宝/微信支付订单中直接显示 plan_id（如 "Subscription Plan plan_ultra_mo"）
3. **中文乱码**：如果使用中文方案名称，支付宝订单信息会显示乱码

---

## ✅ 推荐方案：优化订单信息显示（已实施）

### 为什么不建议修改 plan_id

1. **数据关联复杂**：涉及多个表的外键关联
   - `payment_orders.planId` - 所有历史订单
   - `user_extensions.planId` 和 `nextPlanId` - 用户当前订阅
   - `user_subscription_history.planId` - 订阅历史记录

2. **风险收益不成正比**：
   - plan_id 是内部标识，用户永远看不到
   - 需要复杂的数据迁移脚本，可能导致数据不一致
   - `_mo` 后缀虽然不规范，但不影响功能
   - 已有订单记录和审计追溯会受影响

3. **更好的替代方案**：优化用户可见的订单信息显示

### 实施方案

**核心思路**：在支付订单中显示友好的方案名称，而不是原始 plan_id

#### 修改内容

1. **类型定义更新** (`src/server/modules/payment/types.ts`)
   - `PaymentOrder` 接口添加可选字段：
     ```typescript
     planSlug?: string;  // 如 'lite', 'pro', 'ultra'
     planName?: string;  // 如 'Lite', 'Pro', 'Ultra'
     ```

2. **PaymentService 更新** (`src/server/modules/payment/index.ts`)
   - 创建订单时，从数据库查询方案信息
   - 将 `planSlug` 和 `planName` 传递给支付渠道

3. **支付渠道更新**
   - **支付宝** (`channels/alipay-precreate.ts`)：
     - 订单 subject 格式：`{PlanName} {Interval} Plan - {Duration}`
     - 示例：`Lite Monthly Plan`, `Pro Annual Plan`, `Ultra Monthly Plan - 3mo`

   - **微信支付** (`channels/wechat-native.ts`)：
     - 订单 body 格式：`{PlanName} {Interval} Plan - {Duration}`
     - 与支付宝保持一致

#### 显示效果对比

**优化前：**
- 支付宝：`Subscription Plan plan_ultra_mo`
- 微信：`订阅方案-plan_ultra_mo`

**优化后：**
- 月订阅：`Ultra Monthly Plan`
- 年订阅：`Pro Annual Plan`
- 一次性 3 个月：`Lite Monthly Plan - 3mo`
- 一次性 12 个月：`Ultra Monthly Plan - 12mo`

#### 优势

✅ **用户友好**：清晰显示方案名称和周期
✅ **避免乱码**：使用英文，不依赖中文编码
✅ **零风险**：不修改数据库，不影响现有数据
✅ **易维护**：集中在支付渠道层处理显示逻辑
✅ **支持一次性付费**：自动显示购买时长

---

## ⚠️ 备选方案：修改 plan_id（不推荐）

如果您坚持修改 plan_id，以下是完整的 SQL 迁移脚本。

**⚠️ 警告：**
- 执行前务必备份数据库
- 在测试环境先执行并验证
- 可能影响正在进行的订单和审计追溯

### SQL 迁移脚本

```sql
-- ============================================================================
-- 订阅方案 ID 重命名迁移
-- 执行前务必备份数据库！
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 更新 subscription_plans 表的主键
-- ----------------------------------------------------------------------------

-- 更新各个方案的 ID
UPDATE subscription_plans SET id = 'plan_lite' WHERE id = 'plan_lite_mo';
UPDATE subscription_plans SET id = 'plan_pro' WHERE id = 'plan_pro_mo';
UPDATE subscription_plans SET id = 'plan_ultra' WHERE id = 'plan_ultra_mo';
-- plan_free 保持不变

-- ----------------------------------------------------------------------------
-- 2. 更新 user_extensions 表的关联
-- ----------------------------------------------------------------------------

-- 更新 planId 字段
UPDATE user_extensions SET plan_id = 'plan_lite' WHERE plan_id = 'plan_lite_mo';
UPDATE user_extensions SET plan_id = 'plan_pro' WHERE plan_id = 'plan_pro_mo';
UPDATE user_extensions SET plan_id = 'plan_ultra' WHERE plan_id = 'plan_ultra_mo';

-- 更新 nextPlanId 字段（如果有）
UPDATE user_extensions SET next_plan_id = 'plan_lite' WHERE next_plan_id = 'plan_lite_mo';
UPDATE user_extensions SET next_plan_id = 'plan_pro' WHERE next_plan_id = 'plan_pro_mo';
UPDATE user_extensions SET next_plan_id = 'plan_ultra' WHERE next_plan_id = 'plan_ultra_mo';

-- 更新 currentPlan 字段（兼容旧数据）
UPDATE user_extensions SET current_plan = 'lite' WHERE current_plan = 'plan_lite_mo';
UPDATE user_extensions SET current_plan = 'pro' WHERE current_plan = 'plan_pro_mo';
UPDATE user_extensions SET current_plan = 'ultra' WHERE current_plan = 'plan_ultra_mo';

-- ----------------------------------------------------------------------------
-- 3. 更新 payment_orders 表的关联
-- ----------------------------------------------------------------------------

UPDATE payment_orders SET plan_id = 'plan_lite' WHERE plan_id = 'plan_lite_mo';
UPDATE payment_orders SET plan_id = 'plan_pro' WHERE plan_id = 'plan_pro_mo';
UPDATE payment_orders SET plan_id = 'plan_ultra' WHERE plan_id = 'plan_ultra_mo';

-- ----------------------------------------------------------------------------
-- 4. 更新 user_subscription_history 表的关联
-- ----------------------------------------------------------------------------

UPDATE user_subscription_history SET plan_id = 'plan_lite' WHERE plan_id = 'plan_lite_mo';
UPDATE user_subscription_history SET plan_id = 'plan_pro' WHERE plan_id = 'plan_pro_mo';
UPDATE user_subscription_history SET plan_id = 'plan_ultra' WHERE plan_id = 'plan_ultra_mo';

-- ----------------------------------------------------------------------------
-- 5. 验证数据完整性
-- ----------------------------------------------------------------------------

-- 检查是否还有旧的 plan_id
SELECT 'user_extensions' as table_name, COUNT(*) as count
FROM user_extensions
WHERE plan_id IN ('plan_lite_mo', 'plan_pro_mo', 'plan_ultra_mo')
OR next_plan_id IN ('plan_lite_mo', 'plan_pro_mo', 'plan_ultra_mo')

UNION ALL

SELECT 'payment_orders', COUNT(*)
FROM payment_orders
WHERE plan_id IN ('plan_lite_mo', 'plan_pro_mo', 'plan_ultra_mo')

UNION ALL

SELECT 'user_subscription_history', COUNT(*)
FROM user_subscription_history
WHERE plan_id IN ('plan_lite_mo', 'plan_pro_mo', 'plan_ultra_mo')

UNION ALL

SELECT 'subscription_plans', COUNT(*)
FROM subscription_plans
WHERE id IN ('plan_lite_mo', 'plan_pro_mo', 'plan_ultra_mo');

-- 如果上述查询全部返回 0，则迁移成功

COMMIT;

-- 执行后验证：
-- SELECT id, slug, name FROM subscription_plans ORDER BY display_order;
```

### 迁移后续步骤

1. **验证数据**：
   ```sql
   -- 检查所有方案 ID
   SELECT id, slug, name FROM subscription_plans ORDER BY display_order;

   -- 检查用户订阅
   SELECT plan_id, COUNT(*) FROM user_extensions GROUP BY plan_id;

   -- 检查订单
   SELECT plan_id, COUNT(*) FROM payment_orders GROUP BY plan_id;
   ```

2. **更新种子数据**：
   修改 `scripts/seed-subscription.ts`，为所有方案明确指定新的 ID：
   ```typescript
   {
     id: 'plan_lite',  // 明确指定
     name: 'Lite',
     slug: 'lite',
     // ...
   }
   ```

3. **更新引用代码**：
   搜索代码中所有硬编码的旧 ID 并替换：
   ```bash
   grep -r "plan_lite_mo" src/
   grep -r "plan_pro_mo" src/
   grep -r "plan_ultra_mo" src/
   ```

---

## 总结

### ✅ 已实施方案（推荐）

优化订单信息显示，使用 `planSlug` 生成友好的支付订单描述。

**优势**：
- 零风险，不修改现有数据
- 用户体验更好
- 避免中文乱码问题
- 支持一次性付费时长显示

### ⚠️ 备选方案（不推荐）

修改 plan_id 数据库记录。

**劣势**：
- 需要复杂的数据迁移
- 可能影响审计追溯
- 风险高，收益低（用户看不到 ID）

---

## 建议

**保持现有 plan_id 不变**，使用已实施的订单信息优化方案即可满足需求。

如果将来创建新方案，建议：
- 使用规范的命名：`plan_{slug}` (如 `plan_lite`, `plan_pro`)
- 或使用自动生成的随机 ID：`pln_{nanoid}` (如 `pln_x1y2z3a4b5c6`)
- 在种子数据中明确指定 ID，避免不一致

---

## 相关文件

- `src/server/modules/payment/types.ts` - 类型定义
- `src/server/modules/payment/index.ts` - PaymentService
- `src/server/modules/payment/channels/alipay-precreate.ts` - 支付宝支付
- `src/server/modules/payment/channels/wechat-native.ts` - 微信支付
- `packages/database/src/schemas/subscription.ts` - 订阅方案表定义
