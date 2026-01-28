# 微信支付集成 - 数据库迁移指南

> 生成时间：2026-01-27
> 迁移版本：v1.0

## 📋 目录

1. [迁移准备](#迁移准备)
2. [执行步骤](#执行步骤)
3. [验证迁移](#验证迁移)
4. [配置微信支付](#配置微信支付)
5. [测试支付流程](#测试支付流程)
6. [回滚方案](#回滚方案)
7. [常见问题](#常见问题)

---

## 迁移准备

### 1. 环境要求

- ✅ PostgreSQL 14+
- ✅ psql 命令行工具
- ✅ 数据库访问权限
- ✅ 足够的磁盘空间（建议至少 1GB）

### 2. 检查当前数据

连接到数据库：

```bash
# 本地开发环境
psql -d protochat_dev

# 或使用连接字符串
psql "postgresql://user:password@localhost:5432/protochat_dev"
```

查看当前方案：

```sql
SELECT slug, name, interval, price/100.0 AS price_yuan, is_active
FROM subscription_plans
ORDER BY slug, interval;
```

查看用户订阅：

```sql
SELECT current_plan, COUNT(*) AS user_count
FROM user_extensions
GROUP BY current_plan;
```

### 3. 备份数据库（⚠️ 必须执行）

```bash
# 方法 1：使用提供的备份脚本
psql -d protochat_dev < backup-database.sql

# 方法 2：完整数据库备份
pg_dump -d protochat_dev > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# 方法 3：只备份关键表
pg_dump -d protochat_dev -t subscription_plans -t user_extensions -t user_subscription_history \
  > critical_tables_backup.sql
```

**确认备份成功：**

```bash
# 检查备份文件大小
ls -lh backup*.sql

# 查看备份文件内容
head -n 50 backup*.sql
```

---

## 执行步骤

### Step 1: 测试环境执行

**⚠️ 强烈建议先在测试环境执行迁移！**

```bash
# 1. 连接测试数据库
psql -d protochat_test

# 2. 执行迁移脚本
\i wechat-pay-migration.sql

# 或者（如果上面的命令不工作）
psql -d protochat_test < wechat-pay-migration.sql
```

**观察输出：**

- ✅ 看到 `COMMIT` 表示事务成功
- ✅ 看到验证通过的提示
- ❌ 看到 `ROLLBACK` 或 ERROR 表示失败，需要检查错误信息

### Step 2: 验证测试环境

```bash
# 运行验证脚本
psql -d protochat_test < verify-migration.sql
```

**检查验证结果：**

- ✓ 所有表和字段都已创建
- ✓ 旧字段已删除
- ✓ 数据完整性通过
- ✓ 外键引用正确
- ✓ 没有数据丢失

如果验证失败，请查看 [常见问题](#常见问题) 或联系开发团队。

### Step 3: 生产环境执行

**确认测试环境迁移成功后，再执行生产迁移！**

```bash
# 1. 生产环境备份（双重保险）
pg_dump -d protochat_prod > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 连接生产数据库
psql -d protochat_prod

# 3. 执行迁移
\i wechat-pay-migration.sql

# 4. 验证迁移
\i verify-migration.sql
```

**建议：** 在低峰时段执行生产迁移（如凌晨 2-4 点）。

---

## 验证迁移

### 自动验证

```bash
# 运行完整验证
psql -d your_database < verify-migration.sql
```

### 手动验证

连接数据库后执行以下查询：

```sql
-- 1. 验证方案表结构
\d subscription_plans

-- 应该看到：
-- - monthly_price (integer)
-- - yearly_price (integer)
-- - display_order (integer)
-- - is_popular (boolean)
-- 不应该看到：
-- - interval
-- - price

-- 2. 验证方案数据
SELECT
  slug,
  name,
  monthly_price / 100.0 AS 月价_元,
  yearly_price / 100.0 AS 年价_元,
  display_order,
  is_popular
FROM subscription_plans
ORDER BY display_order DESC;

-- 3. 验证用户数据
SELECT
  current_plan,
  billing_interval,
  COUNT(*) AS 用户数
FROM user_extensions
WHERE current_plan IS NOT NULL
GROUP BY current_plan, billing_interval;

-- 4. 验证新表
SELECT COUNT(*) FROM payment_orders;  -- 应该返回 0（新表为空）
SELECT COUNT(*) FROM payment_notifications;  -- 应该返回 0

-- 5. 验证外键完整性
SELECT COUNT(*) AS 无效引用数
FROM user_extensions ue
LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
WHERE ue.plan_id IS NOT NULL AND sp.id IS NULL;
-- 应该返回 0
```

### 验证清单

- [ ] 所有表和字段已创建
- [ ] 旧字段已删除
- [ ] 方案数据已合并（月/年合并为一行）
- [ ] 用户的 `plan_id` 引用正确
- [ ] 用户的 `billing_interval` 已设置
- [ ] 订阅历史记录正确
- [ ] 没有数据丢失
- [ ] 验证脚本全部通过

---

## 配置微信支付

### 1. 获取微信支付参数

登录 [微信支付商户平台](https://pay.weixin.qq.com/)：

**获取 AppID：**
- 微信公众平台 → 开发 → 基本配置
- 复制 AppID

**获取商户号：**
- 微信支付商户平台 → 账户中心 → 商户信息
- 复制商户号

**设置 API 密钥：**
- 账户中心 → API安全 → 设置API密钥
- 设置32位密钥（如：`abcd1234efgh5678ijkl9012mnop3456`）

**配置回调 URL：**
- 产品中心 → 开发配置 → 支付回调URL
- 添加：`https://yourdomain.com/api/payment/wechat/notify`

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.wechat-pay.example .env.local
```

编辑 `.env.local`，填写真实参数：

```env
WECHAT_PAY_APP_ID=wx0123456789abcdef
WECHAT_PAY_MCH_ID=1600000000
WECHAT_PAY_API_KEY=abcd1234efgh5678ijkl9012mnop3456
WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify
CRON_SECRET=your-random-secret-key
```

### 3. Vercel 环境变量配置

如果使用 Vercel 部署：

1. 进入 Vercel 项目 → Settings → Environment Variables
2. 添加以上所有变量
3. 选择 `Production` 环境
4. 保存并重新部署

### 4. 配置 Cron 任务

编辑 `vercel.json`（如果不存在则创建）：

```json
{
  "crons": [
    {
      "path": "/api/cron/subscription",
      "schedule": "5 0 * * *",
      "description": "每日订阅维护：积分发放和到期处理"
    },
    {
      "path": "/api/cron/cleanup-orders",
      "schedule": "0 3 * * 0",
      "description": "每周清理 90 天前的未支付订单"
    }
  ]
}
```

提交并部署：

```bash
git add vercel.json
git commit -m "feat: add cron jobs for subscription maintenance"
git push
```

---

## 测试支付流程

### 1. 本地测试（开发环境）

```bash
# 启动开发服务器
pnpm dev
```

访问：http://localhost:3010/subscription/plans

**测试步骤：**

1. 点击"升级"按钮
2. 弹出支付弹窗
3. 检查二维码是否生成
4. 检查后端日志：
   - 订单创建成功
   - 微信 API 调用成功
   - 返回 code_url

**⚠️ 注意：**
- 本地环境微信回调无法触发（因为 localhost 不是公网地址）
- 需要使用 ngrok 或部署到测试服务器才能测试完整流程

### 2. 使用 ngrok 测试本地回调

```bash
# 安装 ngrok（如果还没有）
npm install -g ngrok

# 启动 ngrok
ngrok http 3010
```

复制 ngrok 提供的公网 URL（如 `https://abc123.ngrok.io`），更新环境变量：

```env
WECHAT_PAY_NOTIFY_URL=https://abc123.ngrok.io/api/payment/wechat/notify
```

重启开发服务器，然后测试完整支付流程。

### 3. 测试环境测试（推荐）

部署到测试服务器（如 Vercel Preview）：

```bash
# 创建测试分支
git checkout -b test/payment-integration

# 推送到远程
git push origin test/payment-integration
```

Vercel 会自动创建 Preview 部署，使用 Preview URL 测试。

### 4. 小额真实测试

**建议使用 0.01 元测试订单：**

1. 临时修改代码，强制订单金额为 1 分：
   ```typescript
   // 仅测试用，测试后删除
   amount = 1; // 1分 = 0.01元
   ```

2. 创建订单并支付
3. 验证：
   - 支付成功
   - 回调接收成功
   - 订阅权益发放
   - 积分到账

4. 测试完成后恢复代码

### 5. 测试检查清单

- [ ] 订单创建成功
- [ ] 二维码正常生成
- [ ] 微信扫码可以打开支付页面
- [ ] 支付成功后收到回调
- [ ] 订单状态更新为 `paid`
- [ ] 用户订阅状态更新
- [ ] 积分正确发放
- [ ] 订阅历史记录正确
- [ ] 轮询检测到支付成功
- [ ] 前端自动跳转

---

## 回滚方案

### 自动回滚（迁移失败时）

如果迁移过程中失败，PostgreSQL 事务会自动回滚，数据不会被修改。

### 手动回滚（迁移成功但发现问题）

**⚠️ 仅在必要时使用！**

```bash
# 1. 停止应用服务
# 2. 恢复备份
psql -d your_database < backup_before_migration_YYYYMMDD_HHMMSS.sql

# 3. 验证恢复
psql -d your_database -c "SELECT slug, interval, price FROM subscription_plans LIMIT 5;"
```

### 部分回滚

如果只需要回滚部分表：

```sql
BEGIN;

-- 删除新表
DROP TABLE IF EXISTS payment_orders CASCADE;
DROP TABLE IF EXISTS payment_notifications CASCADE;

-- 从备份恢复旧表
-- 需要先导出旧表数据，这里假设已有备份
\copy subscription_plans FROM 'subscription_plans_backup.csv' CSV HEADER;
\copy user_extensions FROM 'user_extensions_backup.csv' CSV HEADER;

COMMIT;
```

---

## 常见问题

### Q1: 迁移脚本执行失败，显示 "relation already exists"

**原因：** 表或字段已经存在（可能是之前执行过迁移）

**解决：**

```sql
-- 检查表是否存在
SELECT tablename FROM pg_tables WHERE tablename = 'payment_orders';

-- 如果存在，先删除再重新执行
DROP TABLE IF EXISTS payment_orders CASCADE;
DROP TABLE IF EXISTS payment_notifications CASCADE;
```

### Q2: 找不到 `plan.interval` 或 `plan.price` 字段

**原因：** 迁移已经执行过，旧字段已删除

**解决：** 不需要重新迁移，检查新字段是否存在：

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'subscription_plans'
  AND column_name IN ('monthly_price', 'yearly_price');
```

### Q3: 用户的 `plan_id` 变成 NULL 或无效

**原因：** 数据迁移逻辑未正确匹配方案

**解决：**

```sql
-- 查找受影响的用户
SELECT ue.user_id, ue.plan_id, ue.current_plan
FROM user_extensions ue
LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
WHERE ue.plan_id IS NOT NULL AND sp.id IS NULL;

-- 根据 current_plan 手动修复
UPDATE user_extensions
SET plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lite' LIMIT 1)
WHERE current_plan = 'lite' AND plan_id IS NULL;
```

### Q4: 验证脚本显示"付费用户缺少 billing_interval"

**原因：** 部分用户的 billing_interval 未正确设置

**解决：**

```sql
-- 根据方案历史记录推断 billing_interval
UPDATE user_extensions ue
SET billing_interval = (
  SELECT billing_interval
  FROM user_subscription_history ush
  WHERE ush.user_id = ue.user_id
    AND ush.status = 'active'
  ORDER BY ush.created_at DESC
  LIMIT 1
)
WHERE ue.current_plan != 'free'
  AND ue.billing_interval IS NULL;

-- 如果仍然为空，默认设置为 'month'
UPDATE user_extensions
SET billing_interval = 'month'
WHERE current_plan != 'free'
  AND billing_interval IS NULL;
```

### Q5: 微信支付回调 403 或签名验证失败

**原因：**
- 回调 URL 未在微信商户平台配置白名单
- API 密钥错误
- 签名算法实现有误

**解决：**

1. 检查微信商户平台配置
2. 验证环境变量：
   ```bash
   echo $WECHAT_PAY_API_KEY
   ```
3. 查看服务器日志获取详细错误信息

### Q6: Cron 任务未执行

**原因：**
- `vercel.json` 配置错误
- `CRON_SECRET` 未配置
- Vercel 项目未启用 Cron

**解决：**

1. 检查 Vercel 项目设置 → Functions → Cron Jobs
2. 手动触发测试：
   ```bash
   curl -X POST https://yourdomain.com/api/cron/subscription \
     -H "Authorization: Bearer your-cron-secret"
   ```

---

## 获取帮助

如果遇到问题：

1. 查看 [常见问题](#常见问题)
2. 检查服务器日志
3. 联系开发团队
4. 提交 Issue：[GitHub Issues](https://github.com/your-repo/issues)

---

## 文件清单

- `wechat-pay-migration.sql` - 主迁移脚本
- `backup-database.sql` - 备份脚本
- `verify-migration.sql` - 验证脚本
- `.env.wechat-pay.example` - 环境变量模板
- `README.md` - 本文档

---

**祝迁移顺利！** 🚀
