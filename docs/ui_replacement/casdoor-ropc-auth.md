# Casdoor ROPC 认证

本文档描述了 ProtoChat 的 Casdoor ROPC（资源所有者密码凭证）认证流程的实现。

## 概述

ROPC 认证允许 ProtoChat 使用自己的品牌登录 / 注册页面，同时使用 Casdoor 作为身份提供商后端，无需将用户重定向到 Casdoor 的 UI。

### 当前流程（OAuth2）

```
用户 → 登录页面 → signIn.oauth2() → 重定向到 Casdoor UI → 回调 → Better-Auth 会话
```

### 新流程（ROPC）

```
用户 → 自定义登录页面 → 服务器 API → Casdoor ROPC API → Better-Auth 会话
```

## 架构

### 核心组件

1. **Casdoor API 模块** (`src/server/modules/Casdoor/`)
   - `types.ts` - Casdoor API 的类型定义
   - `index.ts` - 带有 ROPC 方法的 CasdoorClient 类

2. **API 路由**
   - `/api/auth/casdoor/login` - ROPC 登录端点
   - `/api/auth/casdoor/signup` - ROPC 注册端点

3. **环境配置**
   - `AUTH_CASDOOR_ROPC_ENABLED` - 启用 / 禁用 ROPC 模式

4. **前端页面**
   - 修改的 `signin/page.tsx` - 支持 ROPC 模式
   - 修改的 `signup/BetterAuthSignUpForm.tsx` - 为 ROPC 添加用户名字段

## 实现细节

### CasdoorClient 类

```typescript
class CasdoorClient {
  // 使用 ROPC 流程获取访问令牌
  async getToken(username: string, password: string): Promise<CasdoorTokenResponse>;

  // 使用访问令牌获取用户信息
  async getUserInfo(accessToken: string): Promise<CasdoorUserInfo>;

  // 在 Casdoor 中创建新用户
  async createUser(userData: CasdoorCreateUserRequest): Promise<void>;

  // 检查 Casdoor 是否已配置
  static isConfigured(): boolean;
}
```

### Casdoor API 注意事项

**重要**：Casdoor `/api/add-user` 端点期望用户数据直接发送，而不是包装在 `{"user": {...}}` 对象中：

```typescript
// ❌ 错误方式
fetch(url, { body: JSON.stringify({ user: userData }) });

// ✅ 正确方式
fetch(url, { body: JSON.stringify(userData) });
```

Casdoor 成功创建用户后返回 `{"status": "ok", "data": "Affected"}`，而不是用户对象。

### 登录 API 流程

1. 接收标识符（邮箱 / 用户名）+ 密码
2. 调用 Casdoor ROPC：`POST {CASDOOR_ISSUER}/api/login/oauth/access_token`
3. 获取用户信息：`GET {CASDOOR_ISSUER}/api/userinfo`
4. 创建 / 更新本地用户记录
5. 创建 / 更新账户记录
6. 创建 Better-Auth 会话
7. 设置会话 cookie

### 注册 API 流程

1. 接收用户名 + 邮箱 + 密码
2. 验证输入（邮箱格式、密码强度、用户名格式）
3. 检查邮箱是否已在本地数据库中存在
4. 在 Casdoor 中创建用户：`POST {CASDOOR_ISSUER}/api/add-user`
5. 使用 ROPC 流程自动登录
6. 返回会话或在自动登录失败时重定向到 `/signin`

### displayName 处理

`displayName` 字段是主项目数据库所必需的，但不是用户可填写的。它在注册期间自动设置为 `username` 值：

```typescript
// 在注册 API 中
await casdoor.createUser({
  name: username,
  email: normalizedEmail,
  password,
  displayName: username, // 自动设置为用户名
});
```

## 配置

### 环境变量

添加到 `.env.local`：

```env
# 启用 Casdoor ROPC 认证模式
AUTH_CASDOOR_ROPC_ENABLED=1

# Casdoor 配置（必需）
AUTH_CASDOOR_ISSUER=http://localhost:8001
AUTH_CASDOOR_ID=a387a4892ee19b1a2249
AUTH_CASDOOR_SECRET=dbf205949d704de81b0b5b3603174e23fbecc354
```

### 服务器配置

`casdoorRopcEnabled` 标志通过服务器配置公开，可以在前端组件中访问：

```typescript
const casdoorRopcEnabled = useServerConfigStore((s) => s.serverConfig.casdoorRopcEnabled);
```

### Casdoor 配置

Casdoor 初始化数据（`docker-compose/local/init_data.json`）已更新：

- 应用程序 `lobechat`：
  - `displayName`: "ProtoChat"
  - `enableSignUp`: true
  - 更新了 logo 和主页 URL

- 组织 `lobechat`：
  - `displayName`: "ProtoChat"
  - 更新了 logo、favicon 和网站 URL

## 文件变更

### 新文件

| 文件路径                                             | 描述                   |
| ---------------------------------------------------- | ---------------------- |
| `src/server/modules/Casdoor/types.ts`                | Casdoor API 的类型定义 |
| `src/server/modules/Casdoor/index.ts`                | CasdoorClient 类实现   |
| `src/server/modules/Casdoor/cookie.ts`               | Cookie 签名工具函数    |
| `src/app/(backend)/api/auth/casdoor/login/route.ts`  | ROPC 登录端点          |
| `src/app/(backend)/api/auth/casdoor/signup/route.ts` | ROPC 注册端点          |

### 修改的文件

| 文件路径                                                        | 变更                                                |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `src/envs/auth.ts`                                              | 添加了 `AUTH_CASDOOR_ROPC_ENABLED` 环境变量         |
| `packages/types/src/serverConfig.ts`                            | 添加了 `casdoorRopcEnabled` 到 `GlobalServerConfig` |
| `src/server/globalConfig/index.ts`                              | 在配置中公开了 `casdoorRopcEnabled`                 |
| `src/app/[variants]/(auth)/signin/page.tsx`                     | 添加了 ROPC 模式支持                                |
| `src/app/[variants]/(auth)/signup/.../BetterAuthSignUpForm.tsx` | 添加了用户名字段                                    |
| `src/locales/default/auth.ts`                                   | 添加了用户名验证翻译                                |
| `locales/en-US/auth.json`                                       | 添加了英文翻译                                      |
| `locales/zh-CN/auth.json`                                       | 添加了中文翻译                                      |
| `docker-compose/local/init_data.json`                           | 更新了 ProtoChat 品牌                               |

## 安全考虑

1. **凭证保护**：客户端密钥仅在服务器端使用
2. **输入验证**：验证邮箱格式、密码强度和用户名格式
3. **速率限制**：考虑添加速率限制以防止暴力攻击
4. **错误处理**：返回通用错误消息以防止用户枚举
5. **Cookie 签名**：会话 Cookie 使用 HMAC-SHA256 签名，格式为 `{token}.{signature}`

## Cookie 签名实现

Better Auth 使用签名 Cookie 来防止会话令牌被篡改。ROPC 登录 / 注册流程必须创建与 Better Auth 兼容的签名 Cookie。

### 签名格式

```
{session_token}.{base64_hmac_signature}
```

签名使用 HMAC-SHA256 算法，密钥为 `AUTH_SECRET` 环境变量。

### 实现文件

- `src/server/modules/Casdoor/cookie.ts` - Cookie 签名工具函数

## 回滚

要禁用 ROPC 模式并恢复到 OAuth 流程：

1. 设置 `AUTH_CASDOOR_ROPC_ENABLED=0` 或删除该变量
2. 将自动使用现有的 OAuth 流程

## 测试

### 手动测试步骤

1. 使用 Casdoor 启动开发环境：

   ```bash
   docker-compose -f docker-compose/local/docker-compose.yml up -d
   ```

2. 设置环境变量：

   ```bash
   export AUTH_CASDOOR_ROPC_ENABLED=1
   ```

3. 启动应用程序：

   ```bash
   bun run dev
   ```

4. 测试登录：
   - 导航到 `/signin`
   - 输入邮箱 / 用户名和密码
   - 验证成功登录和重定向

5. 测试注册：
   - 导航到 `/signup`
   - 填写用户名、邮箱和密码
   - 验证成功注册和自动登录

## 开发进度

- [x] 阶段 1：Casdoor API 模块
  - [x] 创建类型定义
  - [x] 实现 CasdoorClient 类

- [x] 阶段 2：API 路由
  - [x] 创建登录端点
  - [x] 创建注册端点

- [x] 阶段 3：前端修改
  - [x] 修改 ROPC 模式的登录页面
  - [x] 修改带用户名字段的注册页面
  - [x] 添加 i18n 翻译

- [x] 阶段 4：配置
  - [x] 添加环境变量
  - [x] 更新服务器配置
  - [x] 更新 Casdoor init_data.json 品牌
