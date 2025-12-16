# ProtoChat 后台管理系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-1890FF?logo=antdesign&logoColor=white)](https://ant.design/)

基于 Ant Design Pro 构建的 ProtoChat 商业版后台管理系统，提供用户管理、套餐配置、API Key 管理、数据统计等功能。

## ✨ 功能特性

- 🔐 **管理员认证系统** - JWT Token 认证，安全的权限控制
- 👥 **用户管理** - 用户列表查看、套餐配置、状态管理
- 📊 **仪表盘统计** - 实时数据展示、快捷操作入口
- 💎 **套餐管理** - 灵活的套餐模板配置
- 🔑 **API Key 管理** - 多厂商 Key 配置，负载均衡
- 📈 **使用统计** - Token 使用监控，成本分析
- 🎨 **响应式设计** - 支持桌面端和移动端

## 🛠️ 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19+ | 前端框架 |
| TypeScript | 5.6+ | 类型安全 |
| UmiJS | 4.3+ | 开发框架 |
| Ant Design | 5.25+ | UI 组件库 |
| Ant Design Pro | 2.7+ | 企业级中后台解决方案 |
| Axios | - | HTTP 客户端 |
| tRPC | 10.x+ | 类型安全的 RPC |

## 🚀 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run start:dev
```

访问 http://localhost:8001

### 默认管理员账号

- 用户名: `admin`
- 密码: `admin123`

> ⚠️ **重要**: 生产环境中请务必修改默认密码！

## 📁 项目结构

```
admin-system/
├── src/
│   ├── components/          # 公共组件
│   ├── pages/              # 页面组件
│   │   ├── Dashboard/      # 仪表盘
│   │   ├── Users/          # 用户管理
│   │   ├── Plans/          # 套餐管理
│   │   ├── ApiKeys/        # API Key管理
│   │   └── user/login/     # 登录页面
│   ├── services/           # API 服务
│   │   ├── admin.ts        # 管理后台 API
│   │   └── api.d.ts        # 类型定义
│   └── app.tsx             # 应用入口配置
├── config/                 # 配置文件
├── package.json
├── .umirc.ts              # UmiJS 配置
└── README.md
```

## 🔧 配置说明

### 端口配置

- **后台管理系统**: 8001 端口
- **API 代理**: 转发到主项目的 3010 端口

### 代理配置

```typescript
// config/proxy.ts
export default {
  dev: {
    '/api/': {
      target: 'http://localhost:3010',
      changeOrigin: true,
      secure: false,
    },
  },
};
```

## 📡 API 接口

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/auth/login` | 管理员登录 |
| GET | `/api/admin/auth/current-user` | 获取当前用户信息 |

### 用户管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 获取用户列表 |
| GET | `/api/admin/users/:id` | 获取用户详情 |
| POST | `/api/admin/users/update-plan` | 更新用户套餐 |
| PUT | `/api/admin/users/:id/status` | 更新用户状态 |

### 统计接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/dashboard/stats` | 获取仪表盘统计数据 |

## 🎯 开发指南

### 添加新页面

1. **创建页面组件**:

```typescript
// src/pages/NewFeature/index.tsx
import { PageContainer } from '@ant-design/pro-components';

const NewFeaturePage: React.FC = () => {
  return (
    <PageContainer>
      {/* 页面内容 */}
    </PageContainer>
  );
};

export default NewFeaturePage;
```

2. **配置路由**:

```typescript
// config/routes.ts
export default [
  {
    path: '/new-feature',
    name: 'newFeature',
    icon: 'NewFeatureIcon',
    component: './NewFeature',
  },
];
```

### 添加 API 服务

```typescript
// src/services/newFeature.ts
import { request } from '@umijs/max';

export async function getNewFeatureData() {
  return request('/api/admin/new-feature/data');
}
```

## 🔒 安全注意事项

1. **密码安全**
   - 修改默认管理员密码
   - 使用强密码策略
   - 定期更换密码

2. **Token 安全**
   - 设置合理的过期时间
   - 使用 HTTPS
   - 实现 Token 刷新机制

3. **权限控制**
   - 遵循最小权限原则
   - 定期审查权限配置
   - 记录操作日志

## 📦 构建部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 🚀 运行说明

### 完整运行步骤

1. **启动 ProtoChat 主项目**:
   ```bash
   cd ..
   bun run dev  # 运行在 3010 端口
   ```

2. **启动后台管理系统**:
   ```bash
   cd admin-system
   npm install
   npm run start:dev  # 运行在 8001 端口
   ```

### 端口配置总结

- **ProtoChat 主项目**: http://localhost:3010
- **后台管理系统**: http://localhost:8001

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🆘 问题反馈

如果您在使用过程中遇到问题，请通过以下方式反馈：

1. 提交 Issue 到项目仓库
2. 联系开发团队

## 📚 相关文档

- [ProtoChat 主项目](../README.md)
- [后台系统开发计划](../ADMIN_SYSTEM_PLAN.md)
- [Ant Design Pro 文档](https://pro.ant.design/)
- [UmiJS 文档](https://umijs.org/)

---

<div align="center">
  Made with ❤️ by ProtoChat Team
</div>