# ProtoChat 自有供应商重构方案

> 文档版本：v1.1
> 创建日期：2026-01-07
> 最后更新：2026-01-07
> 状态：Phase 1-2 已完成，Phase 3 待实施

---

## 一、项目概述

### 1.1 背景

将系统从"多供应商全局配置+积分计费"模式，改造为"单一自有供应商(ProtoChat)+内部多供应商整合"模式。

### 1.2 核心目标

- 创建ProtoChat作为唯一对外计费供应商
- 套壳整合底层供应商（OpenRouter、DeepSeek等）
- 用户只能看到和使用ProtoChat已启用的模型
- 保留用户个人配置其他供应商的能力（但不计费）
- 支持动态扩展底层供应商

### 1.3 技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 架构模式 | 完全数据库驱动 | 长期可维护，支持动态配置 |
| 定价系数 | 默认1.0 | 成本价=用户价，后续可调整 |
| 初始供应商 | OpenRouter + DeepSeek | 覆盖主流模型 |
| 数据库 | 单实例（主项目+后台共享） | 简化架构，直接查询 |

---

## 二、架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                              │
│  - 设置-服务商：ProtoChat详情页（只读配置 + 模型列表）           │
│  - 用户可以启用/禁用ProtoChat的模型（只影响自己）               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       主项目后端                               │
│  Repository.fetchBuiltinModels('protochat')                   │
│    ↓                                                          │
│  从数据库获取已启用的ProtoChat模型列表                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      对话Runtime层                            │
│  initModelRuntimeWithUserPayload('protochat', ...)            │
│    ↓                                                          │
│  查询模型映射（protochat::gpt-4o → openai/gpt-4o）              │
│    ↓                                                          │
│  使用底层供应商的apiKey初始化Runtime                          │
│    ↓                                                          │
│  调用底层供应商API（OpenRouter/DeepSeek）                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       计费系统                                │
│  handleBilling('protochat', model, usage, userId)             │
│    ↓                                                          │
│  查询定价：user_input_price × input_tokens                    │
│    ↓                                                          │
│  扣除积分（已乘定价系数）                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      后台管理系统                              │
│  - ProtoChat供应商管理（配置OpenRouter/DeepSeek等）             │
│  - 模型管理（从供应商API拉取）                                  │
│  - 定价管理（同步成本价 × 定价系数 = 用户价）                    │
│  - 定时任务：每天同步定价                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户发起聊天请求
  ↓
aiChatRouter (provider='protochat', model='protochat::gpt-4o')
  ↓
initProtoChatRuntime
  ↓
protochatModelMapping.getModelMapping('protochat::gpt-4o')
  ↓
返回: { originalId: 'openrouter::openai/gpt-4o', apiKey: 'xxx', baseUrl: 'xxx' }
  ↓
ModelRuntime.initializeWithProvider('openrouter', { model: 'openai/gpt-4o', ... })
  ↓
调用OpenRouter API
  ↓
返回响应 + usage (inputTokens, outputTokens)
  ↓
handleBilling → 查询定价 → 扣除积分 → 记录日志
  ↓
返回给用户
```

---

## 三、数据库设计

### 3.1 数据库表概览

| 表名 | 用途 | 主要字段 |
|------|------|----------|
| `protochat_providers` | 底层供应商配置 | id, name, type, apiKey, baseUrl, enabled |
| `protochat_models` | ProtoChat模型列表 | id, originalId, originalProvider, displayName, enabled |
| `protochat_model_pricing` | 模型定价 | modelId, costInputPrice, userInputPrice, isFree |
| `protochat_settings` | 全局设置 | id, value (定价系数等) |
| `protochat_usage_logs` | 使用日志 | userId, modelId, tokens, price |

### 3.2 详细Schema

#### 3.2.1 protochat_providers（底层供应商配置）

```sql
CREATE TABLE protochat_providers (
  id VARCHAR(64) PRIMARY KEY,           -- 'openrouter', 'deepseek'
  name VARCHAR(100) NOT NULL,            -- '显示名称'
  type VARCHAR(50) NOT NULL,             -- 'aggregator' | 'direct'
  enabled BOOLEAN DEFAULT true NOT NULL,
  priority INT DEFAULT 0,                -- 优先级（用于选择）

  -- API配置
  api_key VARCHAR(500),                  -- API Key（后续加密）
  base_url VARCHAR(500),                 -- Base URL
  api_endpoint VARCHAR(500),             -- 可选的自定义端点

  -- 定价同步配置
  pricing_sync_strategy VARCHAR(50),     -- 'api' | 'model_bank' | 'manual'
  pricing_api_url VARCHAR(500),

  -- 其他配置
  settings JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX protochat_providers_enabled_idx ON protochat_providers(enabled);
CREATE INDEX protochat_providers_priority_idx ON protochat_providers(priority);
```

#### 3.2.2 protochat_models（模型列表）

```sql
CREATE TABLE protochat_models (
  id VARCHAR(200) PRIMARY KEY,            -- 'protochat::gpt-4o'
  original_id VARCHAR(200) NOT NULL,      -- 'openrouter::openai/gpt-4o'
  original_provider VARCHAR(64) NOT NULL, -- 'openrouter'
  display_name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL,              -- 'chat' | 'image' | 'embedding'
  enabled BOOLEAN DEFAULT true NOT NULL,  -- 后台是否启用

  -- 模型能力
  capabilities JSONB,                     -- {functionCall, vision, reasoning, etc}
  context_tokens INT,
  max_output INT,

  -- 模型参数和配置
  parameters JSONB,
  settings JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(original_id)
);

CREATE INDEX protochat_models_original_provider_idx ON protochat_models(original_provider);
CREATE INDEX protochat_models_enabled_idx ON protochat_models(enabled);
```

#### 3.2.3 protochat_model_pricing（模型定价）

```sql
CREATE TABLE protochat_model_pricing (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(200) NOT NULL REFERENCES protochat_models(id) ON DELETE CASCADE,

  -- 成本价（积分/百万tokens）
  cost_input_price DECIMAL(10,4) NOT NULL,
  cost_output_price DECIMAL(10,4) NOT NULL,

  -- 用户价（积分/百万tokens）= 成本价 × 系数
  user_input_price DECIMAL(10,4) NOT NULL,
  user_output_price DECIMAL(10,4) NOT NULL,

  -- 定价来源
  currency VARCHAR(10) DEFAULT 'USD',
  price_source VARCHAR(50),               -- 'api' | 'model_bank' | 'manual'
  is_free BOOLEAN DEFAULT false,

  -- 同步时间
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(model_id)
);

CREATE INDEX protochat_pricing_model_id_idx ON protochat_model_pricing(model_id);
```

#### 3.2.4 protochat_settings（全局设置）

```sql
CREATE TABLE protochat_settings (
  id VARCHAR(50) PRIMARY KEY,             -- 'pricing_multiplier'
  value DECIMAL(10,4) NOT NULL,           -- 1.0
  description VARCHAR(500),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 初始数据
INSERT INTO protochat_settings (id, value, description)
VALUES ('pricing_multiplier', 1.0, '定价系数：成本价 × 系数 = 用户价');
```

#### 3.2.5 protochat_usage_logs（使用日志）

```sql
CREATE TABLE protochat_usage_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  model_id VARCHAR(200) NOT NULL,
  original_provider VARCHAR(64) NOT NULL,

  -- Token使用
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  total_tokens INT NOT NULL,

  -- 费用
  cost_input_price DECIMAL(10,4),
  cost_output_price DECIMAL(10,4),
  user_price DECIMAL(10,4),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX protochat_usage_user_id_idx ON protochat_usage_logs(user_id);
CREATE INDEX protochat_usage_model_id_idx ON protochat_usage_logs(model_id);
CREATE INDEX protochat_usage_created_at_idx ON protochat_usage_logs(created_at);
```

### 3.3 初始数据

```sql
-- OpenRouter配置
INSERT INTO protochat_providers (id, name, type, enabled, priority, base_url, pricing_sync_strategy)
VALUES (
  'openrouter',
  'OpenRouter',
  'aggregator',
  true,
  10,
  'https://openrouter.ai/api/v1',
  'api'
);

-- DeepSeek配置
INSERT INTO protochat_providers (id, name, type, enabled, priority, base_url, pricing_sync_strategy)
VALUES (
  'deepseek',
  'DeepSeek',
  'direct',
  true,
  5,
  'https://api.deepseek.com',
  'model_bank'
);
```

---

## 四、核心服务设计

### 4.1 ProtoChatModelMappingService

**文件位置：** `src/server/services/protochatModelMapping.ts`

**职责：**
- 查询模型映射关系
- 返回底层供应商的apiKey和baseUrl
- 转换模型ID

**关键方法：**

```typescript
interface ProtoChatModelMapping {
  originalId: string;       // 'openrouter::openai/gpt-4o'
  originalProvider: string; // 'openrouter'
  apiKey: string;
  baseUrl: string;
  type: string;
}

class ProtoChatModelMappingService {
  // 获取模型映射
  async getModelMapping(modelId: string): Promise<ProtoChatModelMapping>;

  // 转换模型ID: 'openrouter::openai/gpt-4o' → 'openai/gpt-4o'
  convertModelId(originalId: string): string;

  // 批量获取（用于预热缓存）
  async batchGetModelMappings(modelIds: string[]): Promise<Map<string, ProtoChatModelMapping>>;
}
```

### 4.2 ProtoChatPricingSync

**文件位置：** `src/server/services/protochatPricingSync.ts`

**职责：**
- 从底层供应商API同步定价（OpenRouter）
- 从Model-Bank同步定价（DeepSeek等）
- 应用定价系数
- 标记免费模型

**关键方法：**

```typescript
class ProtoChatPricingSync {
  // 同步所有定价（混合策略）
  async syncAllPricing(): Promise<SyncResult>;

  // 从供应商API同步
  private async syncFromProviderAPI(provider: Provider): Promise<void>;

  // 从Model-Bank同步
  private async syncFromModelBank(provider: Provider): Promise<void>;

  // 应用定价系数
  private async applyPricingMultiplier(): Promise<void>;

  // USD转积分: 1 USD = 500,000 Credits
  private usdToCredits(usdPrice: number): number;
}
```

### 4.3 ProtoChatModelSync

**文件位置：** `src/server/services/protochatModelSync.ts`

**职责：**
- 从底层供应商API拉取模型列表
- 更新模型能力和参数
- 支持增量同步

**关键方法：**

```typescript
class ProtoChatModelSync {
  // 同步所有供应商的模型
  async syncAllModels(): Promise<SyncResult>;

  // 从OpenRouter同步
  private async syncOpenRouterModels(provider: Provider): Promise<void>;

  // 从DeepSeek/Model-Bank同步
  private async syncDeepSeekModels(provider: Provider): Promise<void>;
}
```

### 4.4 Runtime改造

**文件位置：** `src/server/modules/ModelRuntime/index.ts`

**改造点：**

```typescript
export const initModelRuntimeWithUserPayload = async (
  provider: string,
  payload: ClientSecretPayload,
  params: any = {},
) => {
  // 特殊处理ProtoChat供应商
  if (provider === 'protochat' || provider === 'ProtoChat') {
    return await initProtoChatRuntime(payload, params);
  }

  // 原有逻辑...
};

const initProtoChatRuntime = async (
  payload: ClientSecretPayload,
  params: any = {},
) => {
  const modelId = params?.model;

  // 1. 查询模型映射
  const mapping = await protochatModelMapping.getModelMapping(modelId);

  // 2. 转换模型ID
  const actualModelId = protochatModelMapping.convertModelId(mapping.originalId);

  // 3. 使用底层供应商初始化Runtime
  return ModelRuntime.initializeWithProvider(mapping.originalProvider, {
    apiKey: mapping.apiKey,
    baseURL: mapping.baseUrl,
    ...params,
    model: actualModelId,
  });
};
```

---

## 五、界面改造

### 5.1 主项目改造

#### 5.1.1 Repository改造

**文件：** `packages/database/src/repositories/aiInfra/index.ts`

**改造点：**
- 在`fetchBuiltinModels`中添加ProtoChat分支
- ProtoChat模型从数据库`protochat_models`表获取
- 添加缓存机制

```typescript
private async fetchBuiltinModels(providerId: string) {
  // 特殊处理ProtoChat
  if (providerId === 'protochat') {
    return await this.fetchProtoChatModels();
  }

  // 原有逻辑：从model-bank获取
  // ...
}

private async fetchProtoChatModels(): Promise<AiProviderModelListItem[]> {
  const models = await db.query.protochatModels.findMany({
    where: (models, { eq }) => eq(models.enabled, true),
  });

  return models.map(m => ({
    id: m.id,
    displayName: m.displayName,
    enabled: true,
    type: m.type,
    providerId: 'protochat',
    abilities: m.capabilities || {},
    contextWindowTokens: m.contextTokens,
    source: 'builtin',
  }));
}
```

#### 5.1.2 ProtoChat详情页改造

**文件：** `src/app/[variants]/(main)/settings/provider/detail/default/ProviderDetialPage.tsx`

**改造点：**
- 检测providerId是否为'protochat'
- 如果是ProtoChat，隐藏配置区域（API Key、Base URL、测试连接）
- 显示提示信息："此服务由系统管理员统一配置"
- 模型列表保持原有功能（用户可以启用/禁用，只影响自己）

```tsx
export function ProviderDetailPage({ providerId }: Props) {
  const isProtoChat = providerId === 'protochat';

  return (
    <div>
      {/* ProtoChat不显示配置区域 */}
      {!isProtoChat && (
        <ProviderConfig providerId={providerId} />
      )}

      {/* ProtoChat显示提示信息 */}
      {isProtoChat && (
        <Alert
          message="此服务由系统管理员统一配置和管理"
          type="info"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 模型列表保持不变 */}
      <ModelList providerId={providerId} />
    </div>
  );
}
```

#### 5.1.3 tRPC权限控制

**文件：** `src/server/routers/lambda/aiProvider.ts`

**改造点：**
- 拦截对ProtoChat供应商的修改操作
- 返回友好的错误提示

```typescript
updateAiProvider: protectedProcedure
  .input(updateSchema)
  .mutation(async ({ input }) => {
    if (input.id === 'protochat') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'ProtoChat供应商由系统管理员管理，无法修改',
      });
    }
    // 原有逻辑...
  }),
```

### 5.2 后台管理界面

#### 5.2.1 新增菜单结构

```
后台管理系统
├─ ProtoChat 配置 (新增)
│   ├─ 底层供应商管理
│   ├─ 模型管理
│   └─ 定价管理
├─ 全局配置 (保留)
│   ├─ AI供应商配置 (标记为Legacy)
│   └─ 模型定价表 (标记为Legacy)
└─ ...
```

#### 5.2.2 底层供应商管理页面

**文件：** `admin-system/src/pages/ProtoChat/Providers/index.tsx`

**功能：**
- 供应商列表展示（表格形式）
- 添加/编辑/删除供应商
- 启用/禁用开关
- 测试连接按钮
- 优先级排序
- API Key安全显示（****）

#### 5.2.3 模型管理页面

**文件：** `admin-system/src/pages/ProtoChat/Models/index.tsx`

**功能：**
- 模型列表展示（支持分页）
- 按供应商筛选
- 从供应商同步模型按钮
- 批量启用/禁用
- 搜索功能
- 模型详情查看

#### 5.2.4 定价管理页面

**文件：** `admin-system/src/pages/ProtoChat/Pricing/index.tsx`

**功能：**
- 定价列表展示
- 同步定价按钮（显示进度）
- 手动编辑定价
- 定价系数设置
- 成本价 vs 用户价对比
- 免费模型标识

---

## 六、计费系统改造

### 6.1 计费逻辑

**文件：** `src/server/routers/lambda/aiChat.ts`

```typescript
async function handleBilling(
  provider: string,
  model: string,
  usage: { inputTokens: number; outputTokens: number },
  userId: string,
) {
  // 只为ProtoChat计费
  if (provider !== 'protochat') {
    return;
  }

  // 查询定价
  const pricing = await db.query.protochatModelPricing.findFirst({
    where: (p, { eq }) => eq(p.modelId, model),
  });

  if (!pricing) {
    logger.error(`Pricing not found for model: ${model}`);
    return;
  }

  // 免费模型
  if (pricing.isFree) {
    logger.info(`Free model used: ${model}`);
    return;
  }

  // 计算费用（使用user价格）
  const inputCost = (usage.inputTokens / 1_000_000) * Number(pricing.userInputPrice);
  const outputCost = (usage.outputTokens / 1_000_000) * Number(pricing.userOutputPrice);
  const totalCost = Math.ceil(inputCost + outputCost);

  // 扣除积分
  await creditService.deductCredits(userId, totalCost, {
    model,
    provider: 'protochat',
  });

  // 记录使用日志
  await db.insert(protochatUsageLogs).values({
    userId,
    modelId: model,
    originalProvider: '', // 从模型映射获取
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
    userPrice: totalCost.toString(),
  });
}
```

### 6.2 定价计算规则

```
成本价 = 供应商API返回的价格 × 500,000 (1 USD = 500,000 Credits)
用户价 = 成本价 × 定价系数（默认1.0）

免费模型：成本价 = 0 → 用户价 = 0
```

---

## 七、实施计划

### Phase 1: 数据库和基础架构（第1-2周）

#### 1.1 数据库Schema和迁移
- [ ] 创建 `packages/database/src/schemas/protochat.ts`
- [ ] 创建数据库迁移脚本
- [ ] 执行迁移，创建5张表
- [ ] 插入初始数据（OpenRouter、DeepSeek供应商配置）
- [ ] 验证表结构和索引

#### 1.2 Drizzle ORM类型生成
- [ ] 运行 `bun run db:generate`
- [ ] 验证类型导出
- [ ] 更新Schema导出

#### 1.3 ProtoChat供应商配置文件
- [ ] 创建 `src/config/modelProviders/protochat.ts`
- [ ] 更新 `src/config/modelProviders/index.ts`

#### 1.4 模型映射服务
- [ ] 创建 `src/server/services/protochatModelMapping.ts`
- [ ] 实现getModelMapping方法
- [ ] 实现convertModelId方法
- [ ] 添加单元测试

#### 1.5 Runtime改造
- [ ] 修改 `src/server/modules/ModelRuntime/index.ts`
- [ ] 实现initProtoChatRuntime函数
- [ ] 添加ProtoChat分支判断

---

### Phase 2: 后台管理界面（第3-4周）

#### 2.1 后台API路由
- [ ] 创建 `admin-system/server/src/routes/protochat-providers.ts`
- [ ] 创建 `admin-system/server/src/routes/protochat-models.ts`
- [ ] 创建 `admin-system/server/src/routes/protochat-pricing.ts`
- [ ] 添加认证中间件

#### 2.2 服务层实现
- [ ] 实现ProtoChatPricingSync服务
- [ ] 实现ProtoChatModelSync服务
- [ ] 实现ProviderService（CRUD）
- [ ] 实现ModelService（CRUD）
- [ ] 实现PricingService（CRUD）

#### 2.3 底层供应商管理页面
- [ ] 供应商列表展示
- [ ] 添加/编辑/删除供应商
- [ ] 启用/禁用供应商
- [ ] 测试连接功能
- [ ] 优先级排序

#### 2.4 模型管理页面
- [ ] 模型列表展示
- [ ] 从供应商API同步模型
- [ ] 批量启用/禁用模型
- [ ] 搜索和筛选功能
- [ ] 分页功能

#### 2.5 定价管理页面
- [ ] 定价列表展示
- [ ] 同步定价按钮
- [ ] 手动编辑定价
- [ ] 定价系数设置
- [ ] 免费模型标识

---

### Phase 3: 主项目集成（第5-6周）

#### 3.1 Repository改造
- [ ] 修改 `packages/database/src/repositories/aiInfra/index.ts`
- [ ] 在fetchBuiltinModels中添加ProtoChat分支
- [ ] 实现fetchProtoChatModels方法
- [ ] 添加缓存逻辑

#### 3.2 主项目API路由
- [ ] 创建 `src/app/(backend)/api/protochat/models/route.ts`

#### 3.3 ProtoChat详情页改造
- [ ] 修改 `ProviderDetialPage.tsx`
- [ ] 添加isProtoChat判断
- [ ] 条件隐藏配置区域
- [ ] 添加提示信息

#### 3.4 tRPC权限控制
- [ ] 修改 `src/server/routers/lambda/aiModel.ts`
- [ ] 添加ProtoChat拦截逻辑

#### 3.5 计费逻辑集成
- [ ] 修改 `src/server/routers/lambda/aiChat.ts`
- [ ] 添加handleBilling函数
- [ ] 实现积分扣除逻辑
- [ ] 添加使用日志记录

---

### Phase 4: 测试和优化（第7周）

#### 4.1 单元测试
- [ ] ProtoChatModelMappingService测试
- [ ] ProtoChatPricingSync测试
- [ ] ProtoChatModelSync测试
- [ ] Runtime初始化测试
- [ ] 计费逻辑测试

#### 4.2 集成测试
- [ ] 端到端流程测试
- [ ] 多供应商切换测试
- [ ] 定价同步测试
- [ ] 计费准确性测试

#### 4.3 性能测试
- [ ] 数据库查询性能测试
- [ ] API响应时间测试
- [ ] 并发压力测试

---

### Phase 5: 数据初始化和上线（第8周）

#### 5.1 初始化数据
- [ ] 配置OpenRouter API Key
- [ ] 配置DeepSeek API Key
- [ ] 从OpenRouter同步模型列表
- [ ] 从Model-Bank同步DeepSeek模型
- [ ] 启用首批模型
- [ ] 同步定价
- [ ] 设置定价系数为1.0

#### 5.2 灰度发布
- [ ] 选择10%用户启用ProtoChat
- [ ] 监控错误率和性能
- [ ] 收集用户反馈
- [ ] 修复发现的问题

#### 5.3 全量发布
- [ ] 逐步扩大到100%用户
- [ ] 持续监控
- [ ] 准备回滚方案

#### 5.4 监控和告警
- [ ] 设置关键指标监控
- [ ] 配置告警规则
- [ ] 配置日志聚合
- [ ] 设置Dashboard

---

## 八、文件清单

### 8.1 新增文件

```
packages/database/src/schemas/protochat.ts                    # ProtoChat数据库Schema
packages/database/src/migrations/xxx_add_protochat_tables.sql # 数据库迁移

src/config/modelProviders/protochat.ts                        # ProtoChat供应商配置
src/server/services/protochatModelMapping.ts                  # 模型映射服务
src/server/services/protochatPricingSync.ts                   # 定价同步服务
src/server/services/protochatModelSync.ts                     # 模型同步服务
src/app/(backend)/api/protochat/models/route.ts               # ProtoChat模型API

admin-system/server/src/routes/protochat-providers.ts         # 后台供应商API
admin-system/server/src/routes/protochat-models.ts            # 后台模型API
admin-system/server/src/routes/protochat-pricing.ts           # 后台定价API
admin-system/src/pages/ProtoChat/Providers/index.tsx          # 供应商管理页面
admin-system/src/pages/ProtoChat/Models/index.tsx             # 模型管理页面
admin-system/src/pages/ProtoChat/Pricing/index.tsx            # 定价管理页面
```

### 8.2 修改文件

```
packages/database/src/schemas/index.ts                        # 导出新Schema
src/config/modelProviders/index.ts                            # 添加ProtoChat供应商
src/server/modules/ModelRuntime/index.ts                      # 添加ProtoChat Runtime
packages/database/src/repositories/aiInfra/index.ts           # 添加fetchProtoChatModels
src/app/[variants]/(main)/settings/provider/detail/default/ProviderDetialPage.tsx  # 隐藏配置区域
src/server/routers/lambda/aiChat.ts                           # 添加计费逻辑
src/server/routers/lambda/aiProvider.ts                       # 添加权限控制
src/server/routers/lambda/aiModel.ts                          # 添加权限控制
```

---

## 九、风险和应对

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| OpenRouter API变更 | 高 | 中 | 版本锁定，适配器隔离 |
| 定价同步失败 | 高 | 中 | 多重同步策略，手动兜底 |
| 性能问题 | 中 | 低 | 缓存机制，数据库索引优化 |
| 数据迁移失败 | 高 | 低 | 备份、回滚脚本、灰度发布 |

---

## 十、扩展能力

### 10.1 添加新底层供应商

添加新供应商只需：
1. 在`protochat_providers`表添加配置
2. 在`ProtoChatModelSync`添加同步逻辑（如果不用Model-Bank）
3. 可选：在`initProtoChatRuntime`添加特殊处理（如果需要）

### 10.2 支持的供应商类型

| 类型 | 示例 | 定价同步策略 | 说明 |
|------|------|-------------|------|
| aggregator | OpenRouter | api | 聚合平台，有API |
| direct | DeepSeek, OpenAI | model_bank | 直连供应商，用Model-Bank |
| custom | 自建服务 | manual | 手动配置 |

---

## 十一、变更日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-07 | v1.0 | 初始方案设计 | Claude |

---

## 附录

### A. 定价计算示例

```
假设：
- GPT-4o 成本价：$5/M input, $15/M output
- 定价系数：1.0

计算：
- 成本input价格 = 5 × 500,000 = 2,500,000 积分/百万tokens
- 成本output价格 = 15 × 500,000 = 7,500,000 积分/百万tokens
- 用户input价格 = 2,500,000 × 1.0 = 2,500,000 积分/百万tokens
- 用户output价格 = 7,500,000 × 1.0 = 7,500,000 积分/百万tokens

用户使用1000 input tokens + 500 output tokens：
- input费用 = (1000 / 1,000,000) × 2,500,000 = 2,500 积分
- output费用 = (500 / 1,000,000) × 7,500,000 = 3,750 积分
- 总费用 = 2,500 + 3,750 = 6,250 积分
```

### B. API Key安全存储

后续版本将使用KeyVaultsGateKeeper进行加密：

```typescript
// 加密存储
const encryptedKey = await keyVaults.encrypt(apiKey);
await db.update(protochatProviders).set({ apiKey: encryptedKey });

// 解密使用
const decryptedKey = await keyVaults.decrypt(provider.apiKey);
```
