  # LobeChat 商业版后台管理系统开发计划

## 项目概述

基于现有的 LobeChat 项目，构建独立的商业版后台管理系统，实现用户管理、套餐管理、API Key管理和Token使用统计等功能。

## 技术架构

### 核心技术栈
- **前端框架**: Ant Design Pro + React 19 + TypeScript
- **后端服务**: 复用现有 tRPC 架构
- **数据库**: PostgreSQL (与现有系统共享)
- **认证系统**: 保留 Casdoor 作为后端认证引擎
- **构建工具**: UmiJS

### 系统架构图
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   前台应用       │    │   管理后台        │    │   Casdoor      │
│  (现有项目)      │◄──►│  (Ant Design Pro)│◄──►│   (用户认证)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  tRPC API       │◄──►│  管理 API         │    │                 │
│  (现有接口)      │    │  (新增接口)        │                    │
└─────────────────┘    └──────────────────┘                    │
         │                       │                            │
         ▼                       ▼                            │
┌─────────────────┐    ┌──────────────────┐                    │
│ PostgreSQL DB   │◄──►│ 业务数据库        │                    │
│  (现有数据)      │    │  (新增表)         │◄───────────────────┘
└─────────────────┘    └──────────────────┘
```

## 开发阶段规划

### 第一阶段：基础框架搭建 (2-3天)

#### 1.1 项目初始化
- [x] 创建开发计划文档
- [ ] 基于 Ant Design Pro 创建后台管理项目
- [ ] 配置 TypeScript、ESLint、Prettier
- [ ] 配置路由和权限系统

#### 1.2 数据库设计
```sql
-- 用户套餐表
CREATE TABLE user_plans (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  plan_type VARCHAR(50) NOT NULL DEFAULT 'free', -- free, basic, pro, enterprise
  monthly_token_limit INTEGER DEFAULT 0,
  monthly_api_calls_limit INTEGER DEFAULT 0,
  features JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, expired
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- API Key 管理表
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL, -- openai, anthropic, google, etc.
  model_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  monthly_quota INTEGER DEFAULT 0,
  current_usage INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 1, -- 优先级，负载均衡时使用
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 管理员表
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin', -- admin, super_admin
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Token 使用记录表
CREATE TABLE token_usage_records (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  model_name VARCHAR(100),
  api_key_id INTEGER REFERENCES api_keys(id),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_date (user_id, created_at),
  INDEX idx_date (created_at)
);
```

### 第二阶段：核心功能开发 (3-4天)

#### 2.1 管理员认证系统
- [ ] 管理员登录页面
- [ ] JWT Token 管理
- [ ] 权限控制中间件
- [ ] 会话管理

#### 2.2 用户管理模块
- [ ] 用户列表页面
- [ ] 用户详情查看
- [ ] 用户套餐管理
- [ ] 用户状态控制（启用/禁用）

#### 2.3 套餐管理模块
- [ ] 套餐配置页面
- [ ] 套餐模板管理
- [ ] 套餐定价设置

### 第三阶段：高级功能开发 (2-3天)

#### 3.1 API Key 管理
- [ ] API Key 列表管理
- [ ] 多厂商 Key 配置
- [ ] 负载均衡配置
- [ ] 使用量监控

#### 3.2 统计报表
- [ ] Token 使用统计
- [ ] 用户活跃度统计
- [ ] 成本分析报表
- [ ] 导出功能

### 第四阶段：集成与测试 (2天)

#### 4.1 与前台系统集成
- [ ] 用户认证接口对接
- [ ] 套餐验证接口
- [ ] 使用限制检查

#### 4.2 测试与部署
- [ ] 功能测试
- [ ] 性能测试
- [ ] 安全测试
- [ ] 部署配置

## 前台认证系统改造计划

### 改造目标
隐藏 Casdoor 细节，提供商业化登录体验

### 实施方案
1. **保留 Casdoor 作为后端认证引擎**
2. **创建自定义登录界面**
3. **通过后端 API 代理认证**

### 实施步骤

#### 步骤1：创建自定义登录组件
- 文件：`src/features/User/SimpleLoginForm.tsx`
- 功能：邮箱+密码登录，完全隐藏 Casdoor 品牌

#### 步骤2：创建后端认证 API
- 文件：`src/app/api/auth/login/route.ts`
- 功能：代理 Casdoor 认证，生成自定义 JWT

#### 步骤3：修改用户面板
- 文件：`src/features/User/UserPanel/PanelContent.tsx`
- 功能：替换原有登录入口

#### 步骤4：JWT Token 管理
- 创建自定义 JWT 生成和验证逻辑
- 实现 HTTP-only Cookie 存储

### 未来扩展计划
- 添加注册功能
- 支持手机号登录
- 社交登录集成
- 多租户支持

## 项目目录结构

```
admin-system/                 # 后台管理系统
├── src/
│   ├── components/          # 公共组件
│   ├── pages/              # 页面组件
│   │   ├── Login/          # 登录页
│   │   ├── Dashboard/      # 仪表盘
│   │   ├── Users/          # 用户管理
│   │   ├── Plans/          # 套餐管理
│   │   └── ApiKeys/        # API Key管理
│   ├── services/           # API 服务
│   ├── utils/              # 工具函数
│   └── layouts/            # 布局组件
├── config/                 # 配置文件
├── mock/                   # Mock 数据
└── package.json

src/server/api/admin/       # 后端管理 API
├── auth.ts                 # 认证相关
├── users.ts                # 用户管理
├── plans.ts                # 套餐管理
└── apiKeys.ts              # API Key管理
```

## 开发优先级

### P0 (核心功能)
1. 管理员登录系统
2. 用户列表查看
3. 用户套餐分配
4. 基础权限控制

### P1 (重要功能)
1. API Key 管理
2. Token 使用统计
3. 套餐模板配置
4. 数据导出

### P2 (增值功能)
1. 高级统计报表
2. 实时监控
3. 告警系统
4. 批量操作

## 风险评估与应对

### 技术风险
1. **数据一致性**：通过数据库事务和约束保证
2. **性能问题**：合理设计索引和缓存策略
3. **安全风险**：严格的权限控制和审计日志

### 进度风险
1. **功能范围过大**：采用敏捷开发，优先实现核心功能
2. **集成复杂度高**：充分测试，分阶段集成

## 成功标准

### 功能完整性
- [ ] 管理员可以登录系统
- [ ] 可以查看和管理用户
- [ ] 可以配置用户套餐
- [ ] 基础的权限控制正常工作

### 性能指标
- [ ] 页面加载时间 < 2秒
- [ ] API 响应时间 < 500ms
- [ ] 支持 1000+ 用户管理

### 安全要求
- [ ] 管理员密码加密存储
- [ ] JWT Token 安全管理
- [ ] 操作日志记录
- [ ] 权限最小化原则

## 后续迭代计划

### V1.1 (1个月后)
- 增加详细的 Token 使用统计
- 实现套餐使用量告警
- 添加批量用户操作功能

### V1.2 (2个月后)
- 实现高级报表和分析
- 添加 API Key 负载均衡
- 支持更多 AI 服务商

### V2.0 (3个月后)
- 多租户支持
- 白标解决方案
- API 开放平台