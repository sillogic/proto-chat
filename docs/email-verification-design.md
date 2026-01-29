# 邮箱验证方案设计文档

## 一、现状分析

### 1.1 现有架构
- **主认证系统：Better Auth** (src/auth.ts)
  - ✅ 已集成邮箱验证插件 `emailVerification` (第94-110行)
  - ✅ 已有发送验证邮件的实现 `sendVerificationEmail`
  - ✅ 已有邮件模板 `getVerificationEmailTemplate`
  - ⚙️ 通过环境变量 `NEXT_PUBLIC_AUTH_EMAIL_VERIFICATION` 控制是否启用（默认false）

- **辅助登录方式：Casdoor SSO**
  - Casdoor 是作为第三方 SSO 选项集成
  - Casdoor 自己的邮箱验证由 Casdoor 平台控制

- **邮件服务：EmailService** (src/server/services/email/index.ts)
  - ✅ 已实现，支持两种发送方式：
    - **Nodemailer**（通过 SMTP）
    - **Resend**（SaaS 服务）

### 1.2 当前问题
- Better Auth 的邮箱验证功能**已实现但未启用**
- 环境变量 `NEXT_PUBLIC_AUTH_EMAIL_VERIFICATION` 当前为 `false`

---

## 二、推荐方案：启用 Better Auth 邮箱验证

**结论：无需使用 Casdoor 的邮箱验证，直接启用 Better Auth 的内置功能即可。**

### 2.1 方案优势
1. **零开发成本** - 代码已经完整实现，只需配置
2. **完全免费** - 使用免费邮件服务（见下文）
3. **统一体验** - 与现有注册/登录流程完美集成
4. **自主可控** - 不依赖 Casdoor 平台

### 2.2 实现步骤

**步骤 1：启用邮箱验证**
在 `.env` 文件中添加：
```env
# 启用邮箱验证（1=启用，0或不设置=禁用）
NEXT_PUBLIC_AUTH_EMAIL_VERIFICATION=1
```

**步骤 2：配置邮件服务**（选择其一）

#### 选项 A：Nodemailer + 免费 SMTP（推荐）

使用免费的 Gmail SMTP 或其他免费邮件服务：

```env
EMAIL_SERVICE_PROVIDER=nodemailer

# Gmail SMTP（完全免费）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # 需要在 Gmail 设置中生成应用专用密码

# 或使用其他免费 SMTP
# QQ邮箱：smtp.qq.com:587
# 163邮箱：smtp.163.com:25
# Outlook：smtp-mail.outlook.com:587
```

#### 选项 B：Resend（推荐，更简单）

[Resend](https://resend.com) 提供免费额度：
- **免费额度：每月 3,000 封邮件**
- **免费域名：100 封/天使用 @resend.dev 域名**
- **完全免费，无需信用卡**

```env
EMAIL_SERVICE_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx  # 在 resend.com 注册获取
RESEND_FROM=onboarding@resend.dev  # 或使用自己的域名
```

**步骤 3：设置 AUTH_URL**
```env
# 你的应用完整 URL（用于生成验证链接）
NEXT_PUBLIC_AUTH_URL=https://your-domain.com
# 或本地开发
NEXT_PUBLIC_AUTH_URL=http://localhost:3010
```

**步骤 4：重启应用**
```bash
bun run dev
```

### 2.3 工作流程
1. 用户填写邮箱、密码注册
2. Better Auth 创建用户，设置 `emailVerified: false`
3. 自动发送验证邮件（包含验证链接，有效期1小时）
4. 用户点击邮件中的链接
5. Better Auth 验证链接，设置 `emailVerified: true`
6. 自动登录用户（`autoSignInAfterVerification: true`）

### 2.4 用户体验
- **注册后立即收到验证邮件**
- **未验证用户无法登录**（`requireEmailVerification: true`）
- **验证链接有效期：1小时**（可在 src/auth.ts:29 修改）

---

## 三、Casdoor 邮箱验证方案（不推荐）

### 3.1 可行性分析
**技术上可行，但有诸多限制：**

1. **仅影响通过 Casdoor 注册的用户**
   - 无法控制通过 Better Auth 直接注册的用户
   - 需要同时维护两套验证逻辑

2. **配置复杂**
   - 需要在 Casdoor 管理后台配置邮件服务器
   - 需要配置 Casdoor 的应用规则
   - 需要修改前端 Casdoor 注册流程

3. **费用问题**
   - Casdoor 开源免费，但需要自己部署
   - 邮件发送成本取决于 Casdoor 配置的邮件服务

### 3.2 为什么不推荐？
- **你的项目已经有完整的 Better Auth 邮箱验证实现**
- Casdoor 更适合作为企业 SSO 选项，而不是主要认证方式
- 增加维护复杂度，没有实际收益

---

## 四、免费邮件服务对比

| 服务商 | 免费额度 | 配置难度 | 可靠性 | 推荐度 |
|--------|---------|---------|--------|--------|
| **Resend** | 3000封/月 | ⭐⭐⭐⭐⭐（最简单） | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Gmail SMTP** | 无限制（单日500封） | ⭐⭐⭐（需要应用密码） | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Mailgun** | 5000封/月（前3个月） | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **SendGrid** | 100封/天 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **QQ/163邮箱** | 单日300-500封 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

### 推荐选择：Resend
- **最简单**：只需 API Key，无需配置复杂的 SMTP
- **最可靠**：专为开发者设计，送达率高
- **完全免费**：3000封/月对于启动项目足够
- **无需信用卡**

---

## 五、成本分析

### 5.1 开发成本
- **Better Auth 方案：0**（已实现）
- **Casdoor 方案：2-3天**（需要研究、配置、测试）

### 5.2 运行成本
- **Resend：免费**（3000封/月内）
- **Gmail SMTP：免费**（无限制）
- **付费扩展：**
  - Resend Pro: $20/月（50,000封）
  - Mailgun: $35/月（50,000封起）

---

## 六、实施建议

### 阶段一：立即启用（5分钟）
1. 添加环境变量 `NEXT_PUBLIC_AUTH_EMAIL_VERIFICATION=1`
2. 配置 Resend（注册账号，获取 API Key）
3. 重启应用
4. 测试注册流程

### 阶段二：监控优化（上线后）
1. 监控邮件发送成功率
2. 根据用户量评估是否需要付费升级
3. 添加重发验证邮件功能（Better Auth 已支持）

### 阶段三：增强功能（可选）
1. 添加"邮箱未验证"提示页面
2. 实现邮箱修改后重新验证
3. 添加验证邮件发送频率限制（防滥用）

---

## 七、技术细节参考

**相关文件位置：**
- Better Auth 配置：`src/auth.ts:94-110`
- 环境变量定义：`src/envs/auth.ts:167, 290`
- 邮件服务实现：`src/server/services/email/index.ts`
- 邮件模板：`src/libs/better-auth/email-templates.ts`

**验证链接格式：**
```
https://your-domain.com/api/auth/verify-email?token=xxxx&callbackURL=/
```

**数据库字段：**
- `users.emailVerified`: boolean（是否已验证）
- `verification` 表：存储验证令牌

---

## 结论

**强烈推荐使用 Better Auth 内置的邮箱验证功能，配合 Resend 免费服务。**

这个方案：
- ✅ 完全免费（3000封/月足够启动阶段）
- ✅ 零开发成本（只需配置环境变量）
- ✅ 自主可控（不依赖 Casdoor）
- ✅ 易于扩展（付费升级容易）
- ✅ 用户体验好（自动发送、自动登录）

**无需考虑 Casdoor 的邮箱验证**，它只适合作为企业 SSO 集成使用，而不是主要的注册验证方式。
