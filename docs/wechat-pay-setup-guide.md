# 微信支付配置指南

> 生成时间：2026-01-27

## 📋 目录

1. [注册与开通](#注册与开通)
2. [获取配置参数](#获取配置参数)
3. [配置环境变量](#配置环境变量)
4. [配置微信商户平台](#配置微信商户平台)
5. [配置 Vercel](#配置-vercel)
6. [本地测试配置](#本地测试配置)

---

## 注册与开通

### 1. 微信公众平台

如果还没有，需要先注册：

1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 注册公众号（服务号或订阅号）
3. 完成账号认证（需要营业执照）

### 2. 微信支付商户平台

1. 访问 [微信支付商户平台](https://pay.weixin.qq.com/)
2. 申请成为商户（需要已认证的公众号）
3. 开通 **Native 支付** 产品
   - 进入：产品中心 → 我的产品
   - 找到"Native支付"并开通

**⏱️ 审核时间：** 通常 1-7 个工作日

---

## 获取配置参数

### 参数 1：WECHAT_PAY_APP_ID（微信 AppID）

**获取位置：** [微信公众平台](https://mp.weixin.qq.com/) → 开发 → 基本配置

```
示例：wx1234567890abcdef
格式：wx 开头，18 位字符
```

### 参数 2：WECHAT_PAY_MCH_ID（商户号）

**获取位置：** [微信支付商户平台](https://pay.weixin.qq.com/) → 账户中心 → 商户信息

```
示例：1600000000
格式：10 位数字
```

### 参数 3：WECHAT_PAY_API_KEY（API 密钥）

**获取位置：** 微信支付商户平台 → 账户中心 → API安全 → 设置API密钥

⚠️ **首次设置流程：**

1. 下载并安装 **微信支付商户平台证书工具**
2. 生成证书请求文件（CSR）
3. 上传 CSR，审核通过后设置 API 密钥
4. **密钥格式：32 位字符**（例如：`abcd1234efgh5678ijkl9012mnop3456`）

```
示例：abcd1234efgh5678ijkl9012mnop3456
格式：32 位字符（字母+数字）
⚠️ 请务必保密，不要泄露！
```

### 参数 4：WECHAT_PAY_NOTIFY_URL（回调地址）

**本地测试：**
```
http://your-ngrok-url.ngrok.io/api/payment/wechat/notify
```

**生产环境：**
```
https://www.protochat.sillogic.com/api/payment/wechat/notify
```

⚠️ **必须是 HTTPS，且必须是公网可访问的地址**

### 参数 5：CRON_SECRET（Cron 密钥）

**生成方式：**

```bash
# 方法 1：使用 openssl（推荐）
openssl rand -base64 32

# 方法 2：在线生成
访问 https://generate-secret.vercel.app/32
```

```
示例：ww+0igxjGRAAR/eTNFQ55VmhQB5KE5trFZseuntThJs=
格式：随机生成的 Base64 字符串
```

---

## 配置环境变量

### 本地开发环境

编辑项目根目录的 `.env` 文件（已为你添加了配置模板）：

```env
# 微信支付配置
WECHAT_PAY_APP_ID=wx1234567890abcdef          # 填写你的 AppID
WECHAT_PAY_MCH_ID=1600000000                  # 填写你的商户号
WECHAT_PAY_API_KEY=abcd1234efgh5678ijkl9012mnop3456  # 填写你的 API 密钥

# 本地测试使用 ngrok 地址（见下文"本地测试配置"）
WECHAT_PAY_NOTIFY_URL=https://abc123.ngrok.io/api/payment/wechat/notify

# Cron 密钥
CRON_SECRET=your-generated-secret-here

# 可选配置（使用默认值）
PAYMENT_ORDER_EXPIRE_HOURS=2
PAYMENT_ORDER_RETENTION_DAYS=90
```

**⚠️ 安全提醒：**
- `.env` 文件已在 `.gitignore` 中，不会提交到 Git
- 请勿将真实密钥分享给他人或提交到公开仓库

---

## 配置微信商户平台

### 1. 配置支付回调 URL

**位置：** 微信支付商户平台 → 产品中心 → 开发配置 → 支付回调URL

**添加回调地址：**
```
生产环境：https://www.protochat.sillogic.com/api/payment/wechat/notify
测试环境：https://your-test-domain.com/api/payment/wechat/notify
```

⚠️ **注意：**
- 必须是 HTTPS 协议
- 必须是已备案的域名（生产环境）
- 本地 ngrok 地址可能需要频繁更新

### 2. 配置 IP 白名单（可选）

**位置：** 账户中心 → API安全 → IP白名单

**添加服务器 IP：**
- Vercel 部署无需配置（Vercel IP 动态变化）
- 如果自建服务器，需添加服务器公网 IP

### 3. 测试环境配置

微信支付的 Native 支付**不支持沙箱环境**，需要使用真实环境测试。

**建议测试方式：**
1. 临时修改订单金额为 **0.01 元**（1 分钱）
2. 使用真实微信扫码支付
3. 验证回调和订阅发放流程
4. 测试完成后恢复正常价格

---

## 配置 Vercel

### 1. 配置环境变量

**位置：** Vercel Dashboard → 你的项目 → Settings → Environment Variables

**添加以下变量：**

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `WECHAT_PAY_APP_ID` | `wx1234567890abcdef` | Production |
| `WECHAT_PAY_MCH_ID` | `1600000000` | Production |
| `WECHAT_PAY_API_KEY` | `你的32位密钥` | Production |
| `WECHAT_PAY_NOTIFY_URL` | `https://www.protochat.sillogic.com/api/payment/wechat/notify` | Production |
| `CRON_SECRET` | `你的Cron密钥` | Production |

**步骤：**
1. 点击 "Add New"
2. 输入变量名和值
3. 选择 "Production" 环境
4. 点击 "Save"
5. 重复以上步骤添加所有变量

### 2. 配置 Cron 任务

在项目根目录创建或编辑 `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/cron/subscription",
      "schedule": "5 0 * * *"
    },
    {
      "path": "/api/cron/cleanup-orders",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

**Cron 说明：**
- `/api/cron/subscription`：每天凌晨 0:05 执行（发放积分、处理过期订阅）
- `/api/cron/cleanup-orders`：每周日凌晨 3:00 执行（清理 90 天前的未支付订单）

**提交配置：**
```bash
git add vercel.json
git commit -m "feat: add cron jobs for subscription maintenance"
git push
```

Vercel 会自动识别并启用 Cron 任务。

### 3. 验证 Cron 配置

**位置：** Vercel Dashboard → 你的项目 → Settings → Cron Jobs

你应该看到两个 Cron 任务已启用。

**手动触发测试：**
```bash
curl -X POST https://www.protochat.sillogic.com/api/cron/subscription \
  -H "Authorization: Bearer your-cron-secret"
```

---

## 本地测试配置

### 方案 1：使用 ngrok（推荐）

**为什么需要 ngrok？**
- 微信支付回调需要公网地址
- 本地 `localhost` 无法接收微信回调
- ngrok 提供临时公网 URL 映射到本地

**步骤：**

1. **安装 ngrok**
   ```bash
   # 访问 https://ngrok.com/ 注册并下载
   # 或使用 npm 安装
   npm install -g ngrok
   ```

2. **启动本地开发服务器**
   ```bash
   bun run dev
   # 服务运行在 http://localhost:3010
   ```

3. **启动 ngrok**
   ```bash
   ngrok http 3010
   ```

4. **复制 ngrok 提供的 URL**
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:3010
                       ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                       复制这个地址
   ```

5. **更新 .env 文件**
   ```env
   WECHAT_PAY_NOTIFY_URL=https://abc123.ngrok.io/api/payment/wechat/notify
   ```

6. **重启开发服务器**
   ```bash
   # Ctrl+C 停止，然后重新运行
   bun run dev
   ```

⚠️ **注意：**
- ngrok 免费版 URL 每次重启会变化，需要更新配置
- ngrok 付费版可以固定子域名

### 方案 2：部署到 Vercel Preview

```bash
# 创建测试分支
git checkout -b test/payment

# 推送到远程
git push origin test/payment
```

Vercel 会自动创建 Preview 部署，使用 Preview URL 进行测试。

**优点：**
- URL 不会频繁变化
- 环境接近生产环境
- 可以使用 Vercel 环境变量

---

## 测试检查清单

### 配置验证

- [ ] AppID 已正确填写（wx 开头）
- [ ] 商户号已正确填写（10 位数字）
- [ ] API 密钥已正确填写（32 位字符）
- [ ] 回调 URL 已配置且为 HTTPS
- [ ] 回调 URL 已在微信商户平台白名单中
- [ ] Cron 密钥已生成并配置
- [ ] Vercel 环境变量已全部添加
- [ ] Cron 任务已配置在 vercel.json

### 功能测试

- [ ] 访问订阅页面能正常显示方案
- [ ] 点击升级按钮能弹出支付弹窗
- [ ] 支付二维码能正常生成
- [ ] 微信扫码能打开支付页面
- [ ] 支付成功后能收到回调
- [ ] 订单状态更新为已支付
- [ ] 用户订阅状态正确更新
- [ ] 积分正确发放
- [ ] 订阅历史记录正确

---

## 常见问题

### Q1: 提示"参数错误"或"签名验证失败"

**可能原因：**
- API 密钥错误
- AppID 或商户号错误
- 签名算法实现有误

**解决方法：**
1. 检查 `.env` 中的配置是否正确
2. 确认 API 密钥没有多余空格
3. 查看服务器日志获取详细错误信息

### Q2: 微信回调 403 或收不到回调

**可能原因：**
- 回调 URL 未在微信商户平台配置
- 回调 URL 不是 HTTPS
- 本地使用 localhost 无法接收回调

**解决方法：**
1. 检查微信商户平台的回调 URL 配置
2. 本地测试使用 ngrok
3. 检查防火墙或安全组设置

### Q3: Cron 任务不执行

**可能原因：**
- vercel.json 未提交
- CRON_SECRET 未配置
- Vercel 项目未启用 Cron

**解决方法：**
1. 确认 vercel.json 已提交并部署
2. 检查 Vercel Dashboard → Settings → Cron Jobs
3. 手动触发测试 Cron 端点

### Q4: 生产环境部署后支付失败

**检查清单：**
1. Vercel 环境变量是否已配置
2. 回调 URL 是否使用了生产域名
3. 微信商户平台回调白名单是否包含生产域名
4. 查看 Vercel 部署日志

---

## 下一步

配置完成后，按以下顺序测试：

1. ✅ **本地测试**
   - 使用 ngrok 配置回调 URL
   - 创建 0.01 元测试订单
   - 完成支付并验证回调

2. ✅ **Preview 环境测试**
   - 部署到 Vercel Preview
   - 使用 Preview URL 测试
   - 验证完整支付流程

3. ✅ **生产环境部署**
   - 配置生产环境变量
   - 更新微信商户平台回调 URL
   - 小额真实测试
   - 监控日志和错误

---

**祝配置顺利！** 🚀

有任何问题，请参考：
- [migrations/README.md](../migrations/README.md) - 数据库迁移指南
- [wechat-papay-analysis.md](./wechat-papay-analysis.md) - 自动续费实现方案
- [payment-data-retention-policy.md](./payment-data-retention-policy.md) - 数据保留策略
