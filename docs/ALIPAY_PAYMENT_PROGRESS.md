# 支付宝支付集成工作记录

**最后更新时间：** 2026-01-30
**当前状态：** 基本完成，待完整测试
**工作暂停原因：** 需要调试回调通知

---

## 📊 工作进度

### ✅ 已完成的工作

1. **后端支付通道实现**
   - ✅ 创建支付宝当面付支付通道（`AlipayPrecreateChannel`）
   - ✅ 实现订单创建、查询、关闭功能
   - ✅ 实现 RSA2 签名生成和验证
   - ✅ 支持沙箱/正式环境切换
   - ✅ 自动识别 PKCS1/PKCS8 密钥格式

2. **支付回调处理**
   - ✅ 创建支付宝回调 API（`/api/payment/alipay/notify`）
   - ✅ 实现签名验证（沙箱环境跳过验证）
   - ✅ 实现订单状态更新
   - ✅ 实现用户订阅开通
   - ✅ 实现积分发放
   - ✅ 实现订阅历史记录
   - ✅ 修复 `planName` 字段缺失问题

3. **前端支付弹窗优化**
   - ✅ 添加支付方式切换器（支付宝/微信）
   - ✅ 支付宝默认选中
   - ✅ 微信支付显示"敬请期待"提示
   - ✅ 支持二维码显示
   - ✅ 订单状态轮询

4. **订阅按钮状态优化**
   - ✅ 当前订阅显示"我的订阅"并禁用
   - ✅ 升级方案显示"订阅升级"
   - ✅ 按钮颜色和样式调整

5. **国际化文本**
   - ✅ 添加支付宝相关中文文案
   - ✅ 添加支付方式切换文案
   - ✅ 添加订阅按钮文案

6. **配置和文档**
   - ✅ 创建 `.env.alipay.example` 配置模板
   - ✅ 创建 `docs/ALIPAY_SETUP_GUIDE.md` 配置指南
   - ✅ 创建手动完成支付脚本

---

### ⚠️ 已知问题

1. **回调通知问题（主要问题）**
   - 状态：已修复导入路径和 planName 字段，但还未完整测试
   - 最后错误：数据库插入成功（已修复）
   - 需要：重新测试完整支付流程，确认回调成功

2. **订单标题乱码（已修复）**
   - 原因：中文标题编码问题
   - 解决：改用英文标题 `Subscription Plan xxx`

3. **密钥格式问题（已修复）**
   - 原因：支付宝沙箱返回 PKCS1 格式密钥
   - 解决：自动识别并转换为正确的 PEM 格式

4. **图标导入错误（已修复）**
   - 原因：从错误的库导入图标
   - 解决：`AlipayOutlined`, `WechatOutlined` 从 `@ant-design/icons` 导入，`CheckCircle`, `XCircle` 从 `lucide-react` 导入

---

## 📁 重要文件清单

### 新增文件

```
src/server/modules/payment/channels/alipay-precreate.ts     # 支付宝支付通道实现
src/app/(backend)/api/payment/alipay/notify/route.ts        # 支付宝回调处理
.env.alipay.example                                          # 支付宝配置模板
docs/ALIPAY_SETUP_GUIDE.md                                  # 支付宝配置指南
scripts/manual-complete-payment.ts                          # 手动完成支付脚本
start-ngrok.js                                              # ngrok 启动脚本
```

### 修改文件

```
src/server/modules/payment/types.ts                         # 添加支付宝配置类型
src/server/modules/payment/index.ts                         # 注册支付宝通道
src/server/routers/lambda/payment.ts                        # 添加支付宝支付方式
src/features/Payment/PaymentModal.tsx                       # 支付弹窗重构
src/app/[variants]/(main)/subscription/plans/features/PlanCard.tsx  # 订阅按钮优化
src/app/[variants]/(main)/subscription/plans/Client.tsx     # 传递当前订阅状态
src/locales/default/subscription.ts                         # 国际化文本
src/app/(backend)/api/payment/wechat/notify/route.ts        # 修复 planName 字段
```

---

## 🔧 当前配置

### 环境变量（`.env`）

```bash
# 支付宝沙箱配置
ALIPAY_APP_ID=9021000159666599
ALIPAY_PRIVATE_KEY=MIIEpAIBAAKCAQEAvkdI+a9C4n8fra5Md+ee9XPKPv8MRVaKFKxNXPJYsCklxLE2cMr+5+wC9fF8cn82SZIhl28DVyXLVVtmVgATtVBFHlA+2sxs3GPNaUQgicYe3oxlD9D2m+0dNr/DG32DmUsnxWjowDvZ5ACMg7dODdWHjSevJCbw7NdiNO5q4PI4WuWClbs+RrfcHnuJiP69/pau5n6ZTfvIeo0TGF3zxG3OfFl5qri1tCnZEoN6lYmChMKn7NKni90vWqPZjjBQ3fSiA4ZFc9OY1rft3fIQwe13eDjhq2oJsTUl34RZkvJoKkqSsFFW7u+2lZ3p1QorfCoi+loKSN4mWmDPpTpJrwIDAQABAoIBAAM8vT4aQD4QQZ631282zpqIdMlrl27akRDW+Z36NY4RtSXKig2TNpEFj+tVR3O/PFI2HUIxTlI+P15dZrlR2QP9sJ9aaCda0QNS41zGHvOZHk9U/ictu/RdLWEQFCa0lPeXsr6GEWer3QInDDz1cmuD1YGOSkmILBMreu1BnSnkjZFyf3h7VTCp3w+P8+FOqVQqXK5w45yj+tIrWgboGxuEdJfEgcbhDcBpCxgbU7EI29h+9aq+5B08bJSK76Wjg+UxxwMM2++P5RkHXEaPwLVSI6L0qhD8viDl/eBCjxv4IKXdJScYnnB4DldhethJ2NriHjUIdO2uFI8aZQWgpiECgYEA6SbSeJOCNv1aIJfRyrofh3AJLA5diO6cPYgtINpgPttppvdjZoh2mwODRc+W7E0lpszy44ov2DQjskLAPGcUNKs+ILhzzitwjpfnjYOBgjyxefEOeeIk9HR9QdVr6qyUAPcNyt9jeB6XOTGygZ2sbWNlOdxj0jYgGgG2Q/L+pdECgYEA0OziYi2pYF7vIV4Fe3oGyYnNX8LgE3cdiumcSPhkkAgcsiT3jpFr+cBPcT8nYPgic2ZZfNGh7HjkdyGkqTB8awQuE9C6ExT/A5rG5J5kyQz1+STUTTunGBMiPubeB+tdkpiJdkEGUHGjYb0LROlfxqda0PmIexV+2rYfYazMV38CgYALtTpeebHRRxmuh1Eup/gLWhHr13DU/n50DJGPk8e/gE8m5kdkj7e9AwkliU4f4aPhY2tTB85tQfkE65sxrU9zcaH2DK0sDjxhvLkQ/yiSvK+A2x0J+9Q1PmBH3QrFRxNLlRxpMpyRHKAlbBx1q9BL0fD0Xd/ZX4RvKeTYNqyY8QKBgQCXFyjkvYbnReCD7f3i/S2ZZIncvg7UpOj9g9JdRx1auDMgdfF97hb7KCOLj5OH4grwD82ZofULEaaPrQnqvUDNF9nGxMU8dYuy7KT3wsC6USA1jHfoXsKJe5Thjo51hbZHBP8sQPwzAuuYDGHw9SEphe/8fuk/shzqSJlLRu8EOwKBgQC3pajKb7WdkDEpXQoKz5ZQE2vdSD7nTFWIWQvkHPmF2fZwenIEhXY6bM61aw4O49Tbway28fciTHxerfp46q64vIS+WEAx2miA4XJXJyBHONRQ2lDtqfoBWMC+yeiCADT0XdlmlQOQIODJ9THPJTC2drtTW/D0OMgc1MQvNtnJ1w==
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm2EOkf1acgkur93q/sRA6VbBBRSaz7bFZAZdJcIgbRos+QCyimTK1sB7ukNEvXAkdKLkJ0lactdbCRd35HjnXlR9A+VsXXf98WpBOkfNswOUkY2NEFTJ5ITCgWQwMoAawLtIUHwHZQgA/f+neRv4CvHQeqozgOkK/NrMEdyAxC1ywMZeDVjlysf/GHkzAHsQTZd7h9fSNio1K63BTsz127qyMxXOe5l3IwUGSP7IS2abLCykiBiGleRZqMN9MzzhUtFtQuUN5ODTGKu7KpFpR98xqyJJqEgGmvQOLQX/Mkza7Z0LfoDAfaMmj6gAVRAdAFj8kRoMhiFw2RhFq3tX6QIDAQAB
ALIPAY_NOTIFY_URL=https://04a15e19c452.ngrok-free.app/api/payment/alipay/notify
ALIPAY_SANDBOX=true
```

**注意：** 这是沙箱环境配置，正式环境需要替换为正式的 APPID 和密钥。

---

## 🧪 测试流程

### 方案一：使用 ngrok 测试完整回调（推荐）

#### 1. 启动 ngrok
```bash
# 新终端窗口
ngrok http 3010
```

复制显示的公网地址（如：`https://xxxx.ngrok-free.app`）

#### 2. 更新环境变量
```bash
ALIPAY_NOTIFY_URL=https://你的ngrok地址/api/payment/alipay/notify
```

#### 3. 重启开发服务器
```bash
# Ctrl+C 停止
bun run dev
```

#### 4. 测试支付
1. 访问：http://localhost:3010/subscription/plans
2. 点击"升级"按钮
3. 扫码支付（沙箱账号）
4. 等待 2-5 秒
5. 应该自动跳转成功页面

#### 5. 验证成功的标志
控制台显示：
```
POST /api/payment/alipay/notify 200
```

---

### 方案二：手动完成支付（快速验证）

如果回调有问题，可以手动完成订单：

```bash
# 从后台日志复制订单号
bun run scripts/manual-complete-payment.ts PC20260130152253752898
```

脚本会自动：
- 更新订单状态
- 开通用户订阅
- 发放积分
- 写入历史记录

---

## 🐛 故障排查

### 问题 1：二维码不显示

**症状：** 支付弹窗一直转圈

**原因：**
- 支付宝接口调用失败
- 字段名不匹配（已修复：`qr_code` → `code_url`）

**解决：** 查看控制台错误信息

---

### 问题 2：回调通知未收到

**症状：** 支付成功但订单状态未更新

**可能原因：**
1. ngrok 未启动或已断开
2. `ALIPAY_NOTIFY_URL` 配置错误
3. 回调接口代码有错误

**排查步骤：**
1. 确认 ngrok 正在运行：`curl https://你的ngrok地址/api/health`
2. 查看开发服务器控制台是否有 `POST /api/payment/alipay/notify` 请求
3. 查看错误日志

---

### 问题 3：数据库字段错误

**症状：** 回调报错 `null value in column "xxx"`

**已修复的字段：**
- ✅ `planName` - 已添加

**解决：** 确保所有必填字段都已填写

---

### 问题 4：密钥格式错误

**症状：** `error:1E08010C:DECODER routines::unsupported`

**解决：**
- 已实现自动格式转换
- 支持 PKCS1 和 PKCS8 格式
- 环境变量中可以直接使用纯 Base64 字符串（无头尾标记）

---

## 📝 待办事项

### 高优先级

- [ ] **完整测试回调流程**
  - [ ] 启动 ngrok
  - [ ] 更新回调地址
  - [ ] 测试支付到成功的完整流程
  - [ ] 验证订阅状态更新
  - [ ] 验证积分发放

- [ ] **错误处理优化**
  - [ ] 添加更详细的错误日志
  - [ ] 支付失败时的用户提示
  - [ ] 回调重试机制

### 中优先级

- [ ] **正式环境配置**
  - [ ] 申请正式应用 APPID
  - [ ] 生成正式环境密钥
  - [ ] 签约当面付功能
  - [ ] 配置正式回调地址（HTTPS）

- [ ] **功能完善**
  - [ ] 订单超时自动关闭
  - [ ] 支付成功页面美化
  - [ ] 订阅管理页面

### 低优先级

- [ ] **签名验证**
  - [ ] 正式环境启用签名验证（当前沙箱跳过）
  - [ ] 添加签名验证日志

- [ ] **周期扣款（可选）**
  - [ ] 调研支付宝周期扣款产品
  - [ ] 实现自动续费功能

---

## 🔑 关键代码位置

### 支付宝支付通道
```typescript
// 文件：src/server/modules/payment/channels/alipay-precreate.ts
// 核心类：AlipayPrecreateChannel
// 主要方法：
//   - createPayment(): 创建支付订单，返回二维码
//   - parseNotification(): 解析支付回调
//   - queryOrder(): 查询订单状态
//   - closeOrder(): 关闭订单
```

### 支付回调处理
```typescript
// 文件：src/app/(backend)/api/payment/alipay/notify/route.ts
// 主要功能：
//   1. 验证签名（沙箱跳过）
//   2. 更新订单状态
//   3. 开通用户订阅
//   4. 发放积分
//   5. 写入历史记录
```

### 前端支付弹窗
```typescript
// 文件：src/features/Payment/PaymentModal.tsx
// 主要功能：
//   - 支付方式切换（支付宝/微信）
//   - 二维码显示
//   - 订单状态轮询（3秒一次）
//   - 倒计时显示（2小时）
```

---

## 📞 支付宝开放平台信息

- **沙箱环境：** https://openhome.alipay.com/develop/sandbox/app
- **文档中心：** https://opendocs.alipay.com/
- **当面付文档：** https://opendocs.alipay.com/open/194
- **沙箱 APPID：** 9021000159666599

---

## 💡 重要提示

1. **沙箱环境限制**
   - 需要使用沙箱专用的 APPID 和密钥
   - 需要使用沙箱买家账号扫码支付
   - 签名验证可能不稳定（已设置为跳过）

2. **生产环境部署前**
   - 必须完整测试回调流程
   - 必须启用签名验证
   - 必须使用 HTTPS 回调地址
   - 建议添加监控和告警

3. **安全注意事项**
   - 永远不要将密钥提交到 Git
   - 生产环境使用环境变量管理密钥
   - 定期轮换密钥
   - 监控异常支付行为

4. **代码维护**
   - 已清理所有调试日志
   - 保留了关键错误日志
   - 代码注释完整

---

## 🎯 下次继续的步骤

1. **启动 ngrok**
   ```bash
   ngrok http 3010
   ```

2. **更新 `.env` 中的回调地址**

3. **重启开发服务器**
   ```bash
   bun run dev
   ```

4. **完整测试一次支付流程**

5. **如果成功，准备部署到生产环境**

---

**文档结束**

有任何问题，查看 `docs/ALIPAY_SETUP_GUIDE.md` 获取详细配置说明。
