# 邮箱验证功能配置指南

## 一、环境变量配置

### 1. 启用邮箱验证

在 `.env` 文件中添加以下配置：

```env
# ===== 启用邮箱验证 =====
NEXT_PUBLIC_AUTH_EMAIL_VERIFICATION=1

# ===== 邮件服务配置（钉钉企业邮箱）=====
EMAIL_SERVICE_PROVIDER=nodemailer

# 钉钉企业邮箱 SMTP 服务器
SMTP_HOST=smtp.qiye.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true

# 企业邮箱账号（请替换为实际账号）
SMTP_USER=noreply@protochat.ai
SMTP_PASS=your-password-here

# ===== Auth URL 配置 =====
# 本地开发环境
NEXT_PUBLIC_AUTH_URL=http://localhost:3010

# 生产环境（部署时修改为实际域名）
# NEXT_PUBLIC_AUTH_URL=https://protochat.ai
```

## 二、钉钉企业邮箱配置步骤

### 步骤 1：创建系统邮箱

1. 登录钉钉管理后台
2. 进入**工作台** → **邮箱** → **企业邮箱管理**
3. 创建新邮箱账号：
   - **推荐邮箱名：** `noreply@your-domain.com`
   - **显示名称：** ProtoChat 系统
   - **设置密码并记录**

### 步骤 2：开启 SMTP 服务

**方法 1：在钉钉管理后台**
- 邮箱管理 → 邮箱设置 → 客户端设置
- 确保 SMTP 服务已开启

**方法 2：登录网页版邮箱**
1. 访问 https://qiye.aliyun.com/
2. 用新创建的邮箱登录
3. 设置 → 客户端设置 → 开启"POP3/SMTP服务"

### 步骤 3：测试 SMTP 连接

使用以下参数测试：
- **SMTP 服务器：** smtp.qiye.aliyun.com
- **端口：** 465（SSL）或 25（无SSL）
- **加密方式：** SSL/TLS
- **账号：** 完整邮箱地址
- **密码：** 邮箱密码

## 三、验证功能测试

配置完成后，按以下步骤测试：

### 1. 启动开发服务器

```bash
bun run dev
```

### 2. 注册新账号

1. 访问 http://localhost:3010
2. 点击"注册"
3. 填写邮箱和密码
4. 提交注册

### 3. 检查邮件

1. 查看注册时填写的邮箱
2. 应该收到一封标题为"验证你的邮箱地址"的邮件
3. 点击邮件中的验证链接

### 4. 验证完成

- 点击链接后会自动跳转并登录
- 用户的 `emailVerified` 字段会变为 `true`

## 四、常见问题排查

### 问题 1：没有收到验证邮件

**可能原因：**
1. SMTP 配置错误
2. SMTP 服务未开启
3. 邮箱密码错误
4. 邮件被拦截

**解决方法：**
1. 检查服务器日志：`bun run dev` 输出中是否有错误信息
2. 确认 SMTP 服务已在钉钉后台开启
3. 尝试用邮箱客户端（如 Foxmail）测试 SMTP 连接
4. 检查收件箱的垃圾邮件文件夹

### 问题 2：SMTP 连接失败

**错误信息示例：**
```
Error: Invalid login: 535 Authentication failed
```

**解决方法：**
1. 确认邮箱账号和密码正确
2. 确认 SMTP 服务已开启
3. 检查是否需要使用"授权码"而不是密码
4. 尝试使用端口 25 替代 465

### 问题 3：邮件发送成功但进入垃圾箱

**解决方法：**
1. 配置 SPF 记录（在域名 DNS 中）
2. 配置 DKIM 签名（在钉钉邮箱管理后台）
3. 第一次收到后标记为"非垃圾邮件"

## 五、邮件模板自定义

邮件模板位置：`src/libs/better-auth/email-templates.ts`

当前验证邮件包含：
- ProtoChat Logo
- 欢迎语
- 验证按钮
- 链接有效期（1小时）
- 如果不是本人操作的提示

如需修改邮件样式，编辑 `getVerificationEmailTemplate` 函数即可。

## 六、生产环境配置

部署到生产环境时，记得修改：

```env
# 修改为实际域名
NEXT_PUBLIC_AUTH_URL=https://protochat.ai

# 其他配置保持不变
NEXT_PUBLIC_AUTH_EMAIL_VERIFICATION=1
EMAIL_SERVICE_PROVIDER=nodemailer
SMTP_HOST=smtp.qiye.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@protochat.ai
SMTP_PASS=your-password
```

## 七、安全建议

1. **不要将 `.env` 文件提交到 Git**
   - 已在 `.gitignore` 中配置

2. **使用强密码**
   - 系统邮箱使用随机生成的强密码

3. **定期轮换密码**
   - 建议每季度更换一次邮箱密码

4. **限制发送频率**
   - 监控邮件发送量，防止滥用
   - Better Auth 已内置频率限制

## 八、监控和维护

### 邮件发送量监控

钉钉企业邮箱通常有发送限制：
- **免费版：** 每天约200-500封（具体看套餐）
- **付费版：** 更高限制

建议：
1. 在钉钉管理后台查看实际限制
2. 监控每日发送量
3. 对于大量用户注册场景，考虑升级套餐

### 日志监控

Better Auth 会记录邮件发送日志：
```
[EmailService] Verification email sent to: user@example.com
[EmailService] Email send failed: <error message>
```

## 九、后续优化

### 功能增强
1. 添加"重新发送验证邮件"按钮
2. 添加验证状态提示页面
3. 邮件模板多语言支持

### 性能优化
1. 使用邮件队列（避免注册慢）
2. 缓存邮件模板
3. 异步发送邮件

## 联系支持

如遇到问题：
1. 查看 Better Auth 文档：https://www.better-auth.com/docs
2. 查看钉钉企业邮箱帮助：https://help.aliyun.com/product/35363.html
3. 检查项目 GitHub Issues
