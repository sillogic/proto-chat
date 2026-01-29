# 后台管理系统优化计划

> 生成时间：2026-01-28
> 项目：ProtoChat Admin System
> 当前状态：功能基本闭环，需进行生产环境就绪性优化

---

## 一、高优先级（影响正常使用和安全）

### 1.1 安全加固

#### 1.1.1 JWT 密钥强制配置
- **文件：** `admin-system/server/src/config/auth.ts`
- **现状：** 未配置 `JWT_SECRET` 环境变量时使用硬编码默认值
- **方案：** 启动时检测，未配置则直接报错退出，不使用默认值
- **工作量：** 小

#### 1.1.2 API 请求频率限制
- **现状：** 无任何 rate limiting，存在暴力破解和 DDoS 风险
- **方案：** 使用 `express-rate-limit` 中间件
  - 登录接口：5 次/分钟
  - 普通 API：100 次/分钟
  - 全局兜底：1000 次/分钟
- **工作量：** 小

#### 1.1.3 输入校验统一化
- **现状：** 部分路由缺少 Zod 校验，可能写入脏数据
- **方案：** 所有 POST/PUT 路由统一加 Zod schema 校验
- **涉及文件：** `admin.ts`, `stats.ts`, `plans.ts`, `users-simplified.ts` 等
- **工作量：** 中

### 1.2 功能补全

#### 1.2.1 实现 resetMonthlyUsage 接口
- **文件：** `admin-system/server/src/routes/users-simplified.ts:179`
- **现状：** 只有占位响应 `{ success: true, message: 'placeholder' }`
- **方案：** 重置用户当月 `user_transactions` 中的消费记录或重新授予积分
- **工作量：** 中

#### 1.2.2 Casdoor OAuth 状态持久化
- **文件：** `admin-system/server/src/routes/auth-casdoor.ts`
- **现状：** OAuth state 存在内存 Map 中，服务器重启后丢失
- **方案：**
  - 方案 A：使用 Redis 存储（推荐，如已有 Redis 实例）
  - 方案 B：使用数据库临时表存储
  - 方案 C：使用 JWT 编码 state（无状态方案）
- **工作量：** 中

---

## 二、中优先级（影响运维效率和数据准确性）

### 2.1 审计日志系统

#### 2.1.1 管理员操作审计
- **现状：** 无任何持久化的操作日志，无法追溯
- **方案：**
  - 新建 `admin_audit_logs` 表（操作人、操作类型、目标、变更内容、IP、时间）
  - 编写审计中间件，自动记录所有写操作（POST/PUT/DELETE）
  - 后台新增"操作日志"页面
- **涉及：** 新建 schema、middleware、route、前端页面
- **工作量：** 大

### 2.2 性能优化

#### 2.2.1 Dashboard N+1 查询修复
- **文件：** `admin-system/server/src/routes/dashboard.ts:74-91`
- **现状：** 7 天增长趋势用 for 循环每天一条 SQL
- **方案：** 合并为单条 SQL，使用 `generate_series` + `LEFT JOIN` 聚合
- **工作量：** 小

#### 2.2.2 定价和用量查询缓存
- **现状：** 每次请求重新计算
- **方案：**
  - 定价数据：内存缓存 + 5 分钟过期（或修改时主动失效）
  - 用户用量：按需评估，可能不适合缓存（实时性要求高）
- **工作量：** 中

### 2.3 数据分析完善

#### 2.3.1 Analytics 模块补全
- **文件：** `admin-system/server/src/routes/analytics.ts`
- **现状：** 收入/成本分析部分实现
- **方案：**
  - 补全收入趋势（按日/周/月）
  - 补全用户留存分析
  - 补全模型使用分布统计
  - 考虑使用 `user_subscription_history` 的 `billing_interval` 区分月付/年付收入
- **工作量：** 大

### 2.4 硬编码常量可配置化

#### 2.4.1 业务参数提取到系统配置
- **现状：** 以下常量硬编码在代码中
  - `SYNC_MULTIPLIER = 500000`（1 USD = 500,000 积分）
  - `CNY_TO_USD = 1 / 7.15`（汇率）
  - `DEFAULT_PRICING_MULTIPLIER = 1.0`
- **方案：** 存入 `system_config` 表或环境变量，后台管理页面可编辑
- **涉及文件：** `pricing-service.ts`, `analytics.ts`
- **工作量：** 中

---

## 三、低优先级（锦上添花）

### 3.1 日志与监控

#### 3.1.1 结构化日志
- **现状：** 全部使用 `console.log` / `console.error`，无格式、无级别
- **方案：** 引入 `pino` 或 `winston`
  - JSON 格式输出
  - 日志级别（debug/info/warn/error）
  - 请求 ID 追踪
  - 生产环境输出到文件或日志服务
- **工作量：** 中

#### 3.1.2 错误追踪集成
- **方案：** 集成 Sentry（前后端均支持）
  - 前端：`@sentry/react`
  - 后端：`@sentry/node`
  - 自动捕获未处理异常和 Promise rejection
- **工作量：** 小

### 3.2 代码质量

#### 3.2.1 后台系统测试覆盖
- **现状：** `jest.config.ts` 存在但无测试文件
- **方案：**
  - 优先覆盖核心 service（usage-service、subscription-service、pricing-service）
  - 关键 API 端点的集成测试
- **工作量：** 大

#### 3.2.2 API 文档生成
- **方案：** 使用 `swagger-jsdoc` + `swagger-ui-express` 自动生成 API 文档
- **工作量：** 中

### 3.3 用户体验

#### 3.3.1 后台页面细节优化
- 表格支持导出（CSV/Excel）
- 操作确认二次弹窗统一
- 批量操作支持（批量启用/停用方案等）
- **工作量：** 中

---

## 执行建议

### 第一阶段：安全与稳定
> 目标：确保生产环境基本安全可用

- [ ] 1.1.1 JWT 密钥强制配置
- [ ] 1.1.2 API 请求频率限制
- [ ] 1.2.1 实现 resetMonthlyUsage
- [ ] 2.2.1 Dashboard N+1 查询修复

### 第二阶段：可观测性
> 目标：出问题时能快速定位

- [ ] 2.1.1 管理员操作审计
- [ ] 3.1.1 结构化日志
- [ ] 3.1.2 错误追踪集成（Sentry）

### 第三阶段：功能完善
> 目标：补全业务闭环

- [ ] 1.1.3 输入校验统一化
- [ ] 1.2.2 Casdoor OAuth 状态持久化
- [ ] 2.3.1 Analytics 模块补全
- [ ] 2.4.1 硬编码常量可配置化

### 第四阶段：质量提升
> 目标：长期可维护

- [ ] 2.2.2 定价和用量查询缓存
- [ ] 3.2.1 测试覆盖
- [ ] 3.2.2 API 文档
- [ ] 3.3.1 后台页面细节优化
