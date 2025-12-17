# ProtoChat 后台管理系统 Casdoor SSO 集成指南

## 📋 概述

本指南将帮助您将 ProtoChat 后台管理系统与 Casdoor SSO 集成，实现统一的身份认证和权限管理。

## 🏗️ 架构设计

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin Frontend│───▶│  Admin API Server│───▶│   Casdoor SSO   │    │  Shared Database│
│   (Port 8001)   │    │   (Port 8002)    │    │   (Port 8000)   │    │ (PostgreSQL)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │  Local JWT Auth │
                    │  (admin users)  │
                    └─────────────────┘
```

### 🔐 认证方式

1. **本地管理员认证**: 使用用户名/密码进行本地认证
2. **Casdoor SSO认证**: 通过 Casdoor 进行统一的身份认证

## 🛠️ 配置步骤

### 1. Casdoor 管理面板配置

#### 1.1 登录 Casdoor 管理面板
- 访问: http://localhost:8000
- 默认管理员: `admin` / `casdoor`

#### 1.2 创建后台管理应用
1. 进入 **Applications** 页面
2. 点击 **Add application**
3. 选择 **Built-in application type**
4. 配置应用信息:

```
应用名称: ProtoChat Admin System
应用类型: Built-in
组织: built-in
```

#### 1.3 配置应用设置
在应用详情页面，配置以下参数：

**基本设置:**
- **Client ID**: `admin-client-id` (或自定义)
- **Client Secret**: 生成一个新的密钥
- **Redirect URIs**: `http://localhost:8002/api/auth/casdoor/callback`
- **Sign on URL**: `http://localhost:8001`

**权限设置:**
- 授权类型: `Authorization Code`
- 令牌端点认证方法: `client_secret_post`
- 范围: `openid profile email`

#### 1.4 创建管理员角色
1. 进入 **Roles** 页面
2. 创建以下角色:
   - `admin-admin` - 管理员
   - `admin-super` - 超级管理员
   - `admin-viewer` - 只读管理员

#### 1.5 添加管理员用户
1. 进入 **Users** 页面
2. 创建或编辑用户
3. 分配相应的管理员角色
4. 确保用户属于 `admin` 组织

### 2. 后台管理系统配置

#### 2.1 更新环境变量
编辑 `admin-system/server/.env` 文件:

```env
# Casdoor Configuration
CASDOOR_ISSUER=http://localhost:8000
CASDOOR_CLIENT_ID=admin-client-id
CASDOOR_CLIENT_SECRET=your-generated-client-secret
CASDOOR_REDIRECT_URI=http://localhost:8002/api/auth/casdoor/callback
CASDOOR_ADMIN_ORGANIZATION=admin
ADMIN_SESSION_SECRET=protochat-admin-session-secret
```

#### 2.2 重启 API 服务器
```bash
cd admin-system/server
npm run dev
```

### 3. 前端集成配置

#### 3.1 登录页面更新
更新登录页面，添加 Casdoor SSO 按钮:

```tsx
// src/pages/user/login/index.tsx
import { getCasdoorAuthUrl } from '@/services/admin';

const handleCasdoorLogin = async () => {
  const response = await getCasdoorAuthUrl('/dashboard');
  if (response.success) {
    window.location.href = response.data.authUrl;
  }
};

// 在登录表单中添加SSO按钮
<Button
  type="primary"
  size="large"
  block
  onClick={handleCasdoorLogin}
>
  使用 Casdoor 登录
</Button>
```

#### 3.2 处理 SSO 回调
创建回调处理页面:

```tsx
// src/pages/auth/casdoor-callback/index.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from '@umijs/max';
import { handleCasdoorCallback } from '@/services/admin';

const CasdoorCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code) {
      handleCasdoorCallback(code, state || '').then((response) => {
        if (response.success) {
          localStorage.setItem('token', response.data.token);
          navigate(response.data.redirectTo || '/dashboard');
        }
      });
    }
  }, [navigate, searchParams]);

  return <div>正在处理登录...</div>;
};

export default CasdoorCallback;
```

## 🔧 API 接口

### Casdoor SSO 相关接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/auth/casdoor/login` | 获取授权URL | 公开 |
| GET | `/api/auth/casdoor/callback` | 处理OAuth回调 | 公开 |
| GET | `/api/auth/casdoor/user-info` | 获取SSO用户信息 | 认证 |

### 本地认证接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 本地管理员登录 | 公开 |
| POST | `/api/auth/logout` | 登出 | 公开 |

## 🧪 测试

### 1. 运行测试脚本
```bash
cd admin-system/server
node test-casdoor.js
```

### 2. 手动测试流程

1. **测试本地登录**
   - 访问: http://localhost:8001/user/login
   - 使用默认账号: `admin` / `admin123`

2. **测试Casdoor SSO**
   - 点击 "使用 Casdoor 登录" 按钮
   - 在 Casdoor 登录页面输入管理员账号
   - 验证是否成功跳转到后台管理页面

## 🔒 权限管理

### 权限层级

1. **超级管理员** (`admin-super`)
   - 所有权限: `users.read`, `users.write`, `plans.read`, `plans.write`, `api_keys.read`, `api_keys.write`, `stats.read`, `system.admin`

2. **管理员** (`admin-admin`)
   - 基本权限: `users.read`, `users.write`, `plans.read`, `plans.write`, `api_keys.read`, `stats.read`

3. **只读管理员** (`admin-viewer`)
   - 只读权限: `users.read`, `plans.read`, `stats.read`

### 权限检查

Casdoor 权限检查基于:
- 用户所属组织 (`admin`)
- 用户角色 (`admin-*`)
- 自定义权限列表

## 🚀 部署注意事项

### 1. 生产环境配置
- 使用 HTTPS URL
- 配置正确的 Casdoor 域名
- 生成安全的 Client Secret
- 设置合适的令牌过期时间

### 2. 安全考虑
- 定期轮换 Client Secret
- 使用强密码策略
- 启用多因素认证
- 监控异常登录

### 3. 容错处理
- 本地认证作为备用方案
- 网络错误时的优雅降级
- 令牌刷新机制

## 🆘 故障排除

### 常见问题

1. **授权URL生成失败**
   - 检查 `CASDOOR_CLIENT_ID` 配置
   - 确认 Casdoor 服务运行正常

2. **回调处理失败**
   - 验证 Redirect URI 配置
   - 检查网络连接

3. **权限不足**
   - 确认用户角色配置
   - 检查组织归属

4. **令牌验证失败**
   - 验证 JWT Secret 配置
   - 检查令牌过期时间

### 日志调试

启用详细日志记录:
```bash
# 设置环境变量
DEBUG=casdoor:*

# 查看服务器日志
npm run dev
```

## 📚 参考资料

- [Casdoor 官方文档](https://casdoor.com/docs/)
- [OAuth 2.0 规范](https://tools.ietf.org/html/rfc6749)
- [OpenID Connect 规范](https://openid.net/connect/)