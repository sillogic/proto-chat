# ProtoChat 后台管理系统 API 服务器

独立的 ProtoChat 后台管理系统 API 服务器，提供用户管理、套餐配置、数据统计等功能。

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL 数据库（与主系统共享）

### 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```env
# 服务器配置
PORT=8002
NODE_ENV=development

# 数据库配置（与主系统共享）
DATABASE_URL=postgresql://postgres:uWNZugjBqixf8dxC@localhost:5432/lobechat

# JWT 配置
JWT_SECRET=protochat-admin-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# CORS 配置
CORS_ORIGIN=http://localhost:8001
```

### 安装和初始化

```bash
# 安装依赖并初始化数据库
npm run setup

# 或者手动执行
npm install
npm run init-db
```

### 启动开发服务器

```bash
# 启动开发服务器
npm run dev

# 或者使用启动脚本
./start-dev.sh  # Linux/Mac
start-dev.bat   # Windows
```

服务器将在 `http://localhost:8002` 启动。

## 📡 API 接口

### 认证接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 管理员登录 | 公开 |
| POST | `/api/auth/logout` | 管理员登出 | 认证 |

### 用户管理接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/users` | 获取用户列表 | users.read |
| GET | `/api/users/:id` | 获取用户详情 | users.read |
| PUT | `/api/users/:id/status` | 更新用户状态 | users.write |
| POST | `/api/users/update-plan` | 更新用户套餐 | plans.write |

### 仪表盘接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/dashboard/stats` | 获取统计数据 | stats.read |
| GET | `/api/dashboard/recent-users` | 获取最近用户 | users.read |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务器健康状态 |

## 🔐 默认管理员账号

- **用户名**: `admin`
- **密码**: `admin123`
- **邮箱**: `admin@protochat.com`

⚠️ **重要**: 生产环境中请立即修改默认密码！

## 🏗️ 架构设计

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Frontend │───▶│  Admin API Server │───▶│  Shared Database│
│   (Port 8001)   │    │   (Port 8002)    │    │ (PostgreSQL)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 特点

- ✅ **独立部署**: API 服务器可以独立部署和扩展
- ✅ **共享数据库**: 与主系统共享用户数据，避免数据不一致
- ✅ **权限控制**: 基于角色的访问控制（RBAC）
- ✅ **JWT 认证**: 安全的令牌认证机制
- ✅ **类型安全**: 使用 TypeScript 和 Drizzle ORM
- ✅ **开发友好**: 热重载、详细的错误日志

## 🔧 开发指南

### 权限系统

权限分为以下几类：

- `users.read`: 查看用户信息
- `users.write`: 修改用户信息
- `plans.read`: 查看用户套餐
- `plans.write`: 修改用户套餐
- `api_keys.read`: 查看 API 密钥
- `api_keys.write`: 修改 API 密钥
- `stats.read`: 查看统计数据
- `system.admin`: 系统管理权限

### 数据库表结构

- `admin_users`: 管理员用户表
- `users`: 用户表（与主系统共享）
- `user_plans`: 用户套餐表
- `api_keys`: API 密钥表
- `system_stats`: 系统统计表

## 📦 部署

### 构建生产版本

```bash
# 构建
npm run build

# 启动生产服务器
npm start
```

### Docker 部署（推荐）

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8002

CMD ["npm", "start"]
```

## 🚨 安全注意事项

1. **修改默认密码**: 生产环境中必须修改默认管理员密码
2. **使用强 JWT 密钥**: 设置复杂的 JWT_SECRET
3. **启用 HTTPS**: 生产环境中必须使用 HTTPS
4. **限制 CORS**: 正确配置 CORS_ORIGIN
5. **定期更新**: 保持依赖项的最新版本

## 🛠️ 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 DATABASE_URL 配置
   - 确保数据库服务器正在运行
   - 检查网络连接和防火墙设置

2. **JWT 令牌错误**
   - 检查 JWT_SECRET 配置
   - 确保客户端正确发送 Authorization 头

3. **权限不足错误**
   - 检查用户权限配置
   - 确保请求包含正确的 Authorization 头

### 日志调试

开发环境中，所有请求和错误都会输出到控制台：

```bash
# 查看详细日志
npm run dev
```

## 📄 许可证

本项目采用 MIT 许可证。