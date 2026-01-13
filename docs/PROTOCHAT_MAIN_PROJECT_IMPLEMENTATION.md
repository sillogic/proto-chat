# ProtoChat 主项目集成实现总结

## 实现状态

### ✅ 已完成的功能

#### 1. 配置层面
- **服务商配置文件**: `src/config/modelProviders/protochat.ts`
  - 已正确配置 ProtoChat 为自有供应商
  - 禁用了用户自定义 API Key 和 Base URL (`showConfig: false`)
  - 禁用了模型获取按钮 (`showModelFetcher: false`)
  - 设置为服务端请求模式 (`disableBrowserRequest: true`)

- **服务商列表**: ProtoChat 已添加到 `DEFAULT_MODEL_PROVIDER_LIST`，优先级最高（列表第一位）

#### 2. 服务层面
- **ProtoChat 服务**: `src/server/services/protochat/index.ts`
  - `getModelMapping()` - 获取模型与底层供应商的映射关系
  - `convertModelId()` - 转换模型 ID（隐藏子供应商信息）
  - `getModelPricing()` - 获取模型定价
  - `calculateCost()` - 计算使用费用（积分）
  - `logUsage()` - 记录使用日志
  - `getEnabledModels()` - 获取启用的模型列表（从数据库）
  - `isProtoChatProvider()` - 判断是否为 ProtoChat 供应商

#### 3. 数据库层面
- **数据库 Schema**: `packages/database/src/schemas/protochat.ts`
  - `protochat_providers` - 底层供应商配置（OpenRouter、DeepSeek 等）
  - `protochat_models` - ProtoChat 模型列表及映射关系
  - `protochat_model_pricing` - 模型定价信息
  - `protochat_usage_logs` - 使用日志
  - `protochat_settings` - 系统设置（如定价系数）

- **用户配置**: `ai_models` 表
  - 每个用户可以独立配置模型的启用/禁用状态
  - 表结构包含 `userId` 字段，实现用户隔离

#### 4. 模型获取层面
- **Repository 层**: `packages/database/src/repositories/aiInfra/index.ts`
  - `fetchBuiltinModels()` - 对 ProtoChat 进行特殊处理
  - `fetchProtoChatModels()` - 从数据库查询 ProtoChat 模型列表
  - 模型列表格式: `protochat::gpt-4o` (隐藏了子供应商信息)

#### 5. 运行时调用层面
- **ModelRuntime**: `src/server/modules/ModelRuntime/index.ts`
  - `initProtoChatRuntime()` - ProtoChat 专用运行时初始化
  - 自动查询模型映射，转换为底层供应商调用
  - 示例流程:
    ```
    用户选择: protochat::gpt-4o
    ↓
    查询数据库: protochat_models 表
    ↓
    获取映射: {
      originalId: 'openrouter::openai/gpt-4o',
      originalProvider: 'openrouter',
      apiKey: '***',
      baseUrl: 'https://openrouter.ai/api/v1'
    }
    ↓
    初始化 Runtime: ModelRuntime.initializeWithProvider('openrouter', {...})
    ↓
    调用底层 API: OpenRouter API → OpenAI GPT-4o
    ```

#### 6. tRPC 路由层面
- **AI Provider 路由**: `src/server/routers/lambda/aiProvider.ts`
  - `getAiProviderList` - 获取用户的服务商列表
  - `getAiProviderRuntimeState` - 获取服务商运行时状态（包含模型列表）
  - `toggleProviderEnabled` - 启用/禁用服务商

- **AI Model 路由**: `src/server/routers/lambda/aiModel.ts`
  - `getAiProviderModelList` - 获取指定服务商的模型列表
  - `toggleModelEnabled` - 切换模型启用状态（按用户隔离）
  - `batchToggleAiModels` - 批量切换模型启用状态
  - `updateAiModel` - 更新模型配置

---

## 用户功能验证清单

### 1. 启用 ProtoChat 服务商

**步骤**:
1. 用户登录主项目
2. 进入"设置" → "语言模型"
3. 在服务商列表中找到 "ProtoChat AI"（应该在列表最前面）
4. 点击启用按钮

**预期结果**:
- ProtoChat 出现在已启用的服务商列表中
- 不显示 API Key 和 Base URL 配置项（由后台管理）
- 不显示"获取模型列表"按钮（模型由后台管理）

### 2. 查看 ProtoChat 模型列表

**步骤**:
1. 启用 ProtoChat 后，点击 ProtoChat 卡片
2. 查看模型列表

**预期结果**:
- 显示从后台数据库同步的模型列表
- 模型 ID 格式: `protochat::gpt-4o`, `protochat::deepseek-chat` 等
- **不显示**子供应商信息（如 openrouter、deepseek 等）
- 所有模型在一个扁平列表中，不按子供应商分组

### 3. 配置模型启用/禁用

**步骤**:
1. 在 ProtoChat 模型列表中，选择/取消选择某些模型
2. 保存配置
3. 使用另一个账号登录，查看模型列表

**预期结果**:
- 第一个用户的配置仅影响该用户自己
- 其他用户看到的模型列表不受影响
- 每个用户可以独立配置自己的模型启用状态

### 4. 在对话窗口选择 ProtoChat 模型

**步骤**:
1. 创建新对话或进入现有对话
2. 点击对话框顶部的模型选择器
3. 查找 ProtoChat 服务商及其模型

**预期结果**:
- 模型选择器中有 "ProtoChat AI" 分组
- 分组下显示所有启用的 ProtoChat 模型
- 模型名称格式: `GPT-4o`, `DeepSeek Chat` 等（显示 displayName）
- 不显示子供应商信息

### 5. 使用 ProtoChat 模型进行对话

**步骤**:
1. 选择一个 ProtoChat 模型（如 `protochat::gpt-4o`）
2. 发送一条消息
3. 等待 AI 回复

**预期结果**:
- AI 正确响应
- 积分被正确扣除
- 使用日志被记录到 `protochat_usage_logs` 表
- 用户看到的是 ProtoChat 模型，无法得知底层使用的是哪个供应商

### 6. 查看模型定价和积分消耗

**步骤**:
1. 使用 ProtoChat 模型发送多条消息
2. 查看积分消耗记录

**预期结果**:
- 积分按照 `protochat_model_pricing` 表中的 `userInputPrice` 和 `userOutputPrice` 计算
- 计算公式: `cost = (inputTokens/1M) * userInputPrice + (outputTokens/1M) * userOutputPrice`
- 免费模型不扣除积分

---

## 数据流完整示意

```
┌─────────────────────────────────────────────────────────────────┐
│                    用户操作: 选择模型                              │
├─────────────────────────────────────────────────────────────────┤
│  1. 用户在对话窗口选择 "ProtoChat AI / GPT-4o"                     │
│  2. 前端存储: { provider: 'protochat', model: 'protochat::gpt-4o' }│
└────────────────────────┬────────────────────────────────────────┘
                         │
┌─────────────────────────┴────────────────────────────────────────┐
│                    发送消息到服务器                                │
├─────────────────────────────────────────────────────────────────┤
│  tRPC: aiChat.sendMessageInServer({                             │
│    provider: 'protochat',                                        │
│    model: 'protochat::gpt-4o',                                  │
│    messages: [...]                                              │
│  })                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌─────────────────────────┴────────────────────────────────────────┐
│              服务器: 初始化 ModelRuntime                           │
├─────────────────────────────────────────────────────────────────┤
│  1. 检测到 provider === 'protochat'                              │
│  2. 调用 initProtoChatRuntime()                                 │
│  3. ProtoChatService.getModelMapping('protochat::gpt-4o')       │
│     ↓ 查询 protochat_models 表                                   │
│     返回: {                                                      │
│       originalId: 'openrouter::openai/gpt-4o',                  │
│       originalProvider: 'openrouter',                            │
│       apiKey: '***',                                             │
│       baseUrl: 'https://openrouter.ai/api/v1'                   │
│     }                                                            │
│  4. convertModelId('openrouter::openai/gpt-4o')                 │
│     → 'openai/gpt-4o'                                            │
│  5. ModelRuntime.initializeWithProvider('openrouter', {         │
│       apiKey: '***',                                             │
│       baseURL: 'https://openrouter.ai/api/v1',                  │
│       model: 'openai/gpt-4o'                                     │
│     })                                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌─────────────────────────┴────────────────────────────────────────┐
│              调用底层 AI 服务 (对用户透明)                          │
├─────────────────────────────────────────────────────────────────┤
│  OpenRouter API → OpenAI GPT-4o 模型                             │
│  用户完全不知道底层使用的是 OpenRouter 还是其他供应商              │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌─────────────────────────┴────────────────────────────────────────┐
│              获取响应 & 计算费用                                   │
├─────────────────────────────────────────────────────────────────┤
│  1. 获取 AI 响应（流式或非流式）                                   │
│  2. 统计 token 使用: inputTokens, outputTokens                   │
│  3. ProtoChatService.calculateCost(                              │
│       'protochat::gpt-4o',                                       │
│       inputTokens,                                               │
│       outputTokens                                               │
│     )                                                            │
│     ↓ 查询 protochat_model_pricing 表                            │
│     cost = (inputTokens/1M) * userInputPrice +                   │
│            (outputTokens/1M) * userOutputPrice                   │
│  4. CreditService.consumeCredit(userId, cost)                   │
│     ↓ 扣除用户积分                                                │
│  5. ProtoChatService.logUsage({                                 │
│       userId, modelId, originalProvider,                         │
│       inputTokens, outputTokens, userPrice                       │
│     })                                                           │
│     ↓ 记录到 protochat_usage_logs 表                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键特性说明

### 1. 子供应商完全透明
- 用户只看到 `ProtoChat AI` 服务商
- 模型 ID 格式: `protochat::gpt-4o`（不包含子供应商信息）
- 底层调用哪个供应商（OpenRouter、DeepSeek 等）完全由后台管理，用户无法得知

### 2. 按用户隔离配置
- 每个用户在 `ai_models` 表中有独立的记录
- 表结构: `(id, providerId, userId)` 为联合主键
- 用户A启用的模型不影响用户B
- 用户A对模型的配置修改也仅对用户A生效

### 3. 后台集中管理
- 底层供应商配置: 在后台系统 `/protochat/providers` 管理
- 模型列表同步: 从 API 自动同步或手动配置
- 定价管理: 在后台系统 `/subscription/model-pricing` 管理
- 用户无法修改这些配置，只能选择启用/禁用模型

### 4. 灵活的定价系统
- 成本价: 从底层供应商获取
- 用户价: 成本价 × 定价系数
- 可按模型独立设置价格
- 支持免费模型

---

## 测试验证步骤

### 前置条件
1. 后台系统已配置至少一个底层供应商（如 OpenRouter）
2. 已同步模型列表到 `protochat_models` 表
3. 已设置模型定价到 `protochat_model_pricing` 表
4. 后台系统已启用 ProtoChat 全局供应商

### 测试步骤

#### 步骤 1: 验证服务商可见性
```bash
# 1. 启动主项目
bun run dev

# 2. 登录用户账号
# 3. 进入 设置 → 语言模型
# 4. 验证:
#    - ProtoChat AI 出现在列表第一位
#    - 点击后不显示 API Key 配置
#    - 不显示模型获取按钮
```

#### 步骤 2: 验证模型列表
```bash
# 1. 点击 ProtoChat AI 卡片
# 2. 验证:
#    - 显示从数据库同步的模型
#    - 模型 ID 格式为 protochat::xxx
#    - 不显示子供应商信息
#    - 所有模型在一个列表，不分组
```

#### 步骤 3: 验证用户隔离
```bash
# 1. 用户A: 启用 protochat::gpt-4o
# 2. 用户A: 禁用 protochat::deepseek-chat
# 3. 切换到用户B
# 4. 验证:
#    - 用户B看到的模型启用状态与用户A无关
#    - 用户B可以独立配置
```

#### 步骤 4: 验证对话调用
```bash
# 1. 在对话窗口选择 ProtoChat::GPT-4o
# 2. 发送消息: "Hello"
# 3. 等待响应
# 4. 验证:
#    - 正常获得回复
#    - 前端显示的是 ProtoChat 模型
#    - 用户无法得知底层使用的供应商
```

#### 步骤 5: 验证积分扣除
```bash
# 1. 查看用户积分余额
# 2. 发送消息并获得回复
# 3. 刷新页面查看积分余额
# 4. 验证:
#    - 积分正确扣除
#    - 扣除金额 = (inputTokens/1M) * userInputPrice +
#                 (outputTokens/1M) * userOutputPrice
```

#### 步骤 6: 验证使用日志
```sql
-- 查询使用日志
SELECT * FROM protochat_usage_logs
WHERE user_id = '当前用户ID'
ORDER BY created_at DESC
LIMIT 10;

-- 验证:
-- - 记录了正确的 modelId (protochat::xxx)
-- - 记录了正确的 originalProvider
-- - inputTokens 和 outputTokens 正确
-- - userPrice 正确计算
```

---

## 已知限制和注意事项

### 1. 模型重复问题
- 如果底层多个供应商提供同一个模型（如 GPT-4o）
- 后台可能会有多个 protochat::gpt-4o-xxx 的记录
- 这是正常的，由后台管理员控制启用哪个

### 2. 模型同步
- 模型列表需要在后台系统手动或自动同步
- 主项目不提供同步功能
- 用户只能看到后台已启用的模型

### 3. 定价更新
- 定价变更在后台系统进行
- 不会影响已有的对话
- 新对话使用新价格

---

## 相关文件清单

### 主项目文件
| 文件 | 作用 |
|------|------|
| `src/config/modelProviders/protochat.ts` | ProtoChat 服务商配置 |
| `src/config/modelProviders/index.ts` | 服务商列表注册 |
| `src/server/services/protochat/index.ts` | ProtoChat 服务逻辑 |
| `src/server/modules/ModelRuntime/index.ts` | 运行时初始化（含 ProtoChat 特殊处理） |
| `src/server/routers/lambda/aiProvider.ts` | 服务商 tRPC 路由 |
| `src/server/routers/lambda/aiModel.ts` | 模型 tRPC 路由 |
| `packages/database/src/schemas/protochat.ts` | ProtoChat 数据库表定义 |
| `packages/database/src/repositories/aiInfra/index.ts` | 模型获取逻辑（含 ProtoChat 特殊处理） |

### 后台系统文件
| 文件 | 作用 |
|------|------|
| `admin-system/src/pages/ProtoChat/` | ProtoChat 管理页面 |
| `admin-system/src/pages/AiProviders/Detail/ProtoChatModelList.tsx` | ProtoChat 模型列表组件 |
| `admin-system/src/pages/Subscription/ModelPricing/` | 模型定价管理 |
| `admin-system/server/src/routes/protochat.ts` | ProtoChat 后端路由 |
| `admin-system/server/src/routes/ai-providers.ts` | 全局供应商后端路由 |

---

## 下一步计划

- [ ] 编写用户使用文档
- [ ] 创建管理员配置指南
- [ ] 添加监控和报警
- [ ] 优化定价同步流程
- [ ] 添加使用统计报表
