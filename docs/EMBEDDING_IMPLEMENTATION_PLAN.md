# Embedding功能完整实现计划

> **文档状态**: Phase 1 已完成，Phase 2 和 Phase 3 待实施
> **创建日期**: 2026-01-13
> **最后更新**: 2026-01-13

## 概述

本文档记录了Embedding功能从配置管理到使用计费的完整实现计划，分为三个阶段：

- **Phase 1** (✅ 已完成): 后台Embedding配置管理系统
- **Phase 2** (⚠️ 待实施): Embedding Token统计和积分扣除
- **Phase 3** (📋 可选): 高级优化功能

---

## Phase 1: Embedding配置管理系统 (已完成)

### 实现内容

#### 1. 数据库表结构

创建了三个新表：

```sql
-- 系统级Embedding配置（单行表）
CREATE TABLE system_embedding_config (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
  provider_id VARCHAR(64) NOT NULL,
  model_id VARCHAR(200) NOT NULL,
  display_name VARCHAR(200),
  api_key TEXT,  -- 加密存储
  base_url VARCHAR(500),
  models_sync_url VARCHAR(500),
  input_price NUMERIC(15,4),
  currency VARCHAR(10) DEFAULT 'USD',
  context_tokens INTEGER,
  dimensions INTEGER DEFAULT 1024,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Embedding模型列表
CREATE TABLE system_embedding_models (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(200) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  provider_id VARCHAR(64) NOT NULL,
  dimensions INTEGER DEFAULT 1024,
  context_tokens INTEGER,
  input_price NUMERIC(15,4),
  currency VARCHAR(10) DEFAULT 'USD',
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Embedding使用日志
CREATE TABLE embedding_usage_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  model_id VARCHAR(200) NOT NULL,
  provider_id VARCHAR(64) NOT NULL,
  input_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_price NUMERIC(15,4),
  user_price NUMERIC(15,4),
  operation_type VARCHAR(50),  -- 'file_chunking', 'semantic_search', 'rag_eval'
  file_id UUID,
  chunk_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. 后台管理界面

- **位置**: `admin-system/src/pages/SystemConfig/Embedding/index.tsx`
- **路由**: `/system-config/embedding`
- **功能**:
  - 供应商配置（API Key、Base URL、同步地址）
  - 模型列表同步和展示
  - 当前使用模型选择
  - 积分消耗预估计算

#### 3. API接口

- `GET /api/admin/system-embedding` - 获取当前配置
- `POST /api/admin/system-embedding` - 更新配置
- `GET /api/admin/system-embedding/models` - 获取模型列表
- `POST /api/admin/system-embedding/sync` - 同步模型列表
- `GET /api/admin/system-embedding/usage` - 获取使用日志

---

## Phase 2: Embedding Token统计和积分扣除 (待实施)

### 重要性

**⚠️ 这是最重要的阶段！** 当前系统虽然可以生成embeddings，但不会消耗用户积分，导致成本无法回收。

### 实现目标

1. 记录embedding操作的token使用量
2. 根据配置的价格自动扣除用户积分
3. 记录使用日志供审计和分析

### 实施步骤

#### Step 1: 修改Model Runtime的Embeddings方法

**文件**: `packages/model-runtime/src/core/openaiCompatibleFactory/index.ts`

**当前代码** (第715-737行):
```typescript
async embeddings(
  payload: EmbeddingsPayload,
  options?: EmbeddingsOptions,
): Promise<Embeddings[]> {
  const res = await this.client.embeddings.create(
    { ...payload, encoding_format: 'float', user: options?.user },
    { headers: options?.headers, signal: options?.signal },
  );

  log('received %d embeddings', res.data.length);
  return res.data.map((item) => item.embedding);
}
```

**修改为**:
```typescript
async embeddings(
  payload: EmbeddingsPayload,
  options?: EmbeddingsOptions,
): Promise<{
  embeddings: Embeddings[];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}> {
  const res = await this.client.embeddings.create(
    { ...payload, encoding_format: 'float', user: options?.user },
    { headers: options?.headers, signal: options?.signal },
  );

  log('received %d embeddings, usage: %o', res.data.length, res.usage);

  return {
    embeddings: res.data.map((item) => item.embedding),
    usage: {
      promptTokens: res.usage?.prompt_tokens || 0,
      totalTokens: res.usage?.total_tokens || 0,
    },
  };
}
```

#### Step 2: 创建Embedding Service

**文件**: `src/server/services/embedding/index.ts` (新建)

```typescript
import { LobeChatDatabase, embeddingUsageLogs, systemEmbeddingConfig } from '@lobechat/database';
import { eq } from 'drizzle-orm';

export class EmbeddingService {
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  /**
   * 获取当前系统Embedding配置
   */
  async getSystemConfig() {
    const [config] = await this.db
      .select()
      .from(systemEmbeddingConfig)
      .where(eq(systemEmbeddingConfig.id, 'default'))
      .limit(1);

    if (!config) {
      throw new Error('System embedding config not found. Please configure in admin panel.');
    }

    return config;
  }

  /**
   * 计算embedding成本（积分）
   * @param inputTokens 输入token数
   * @returns 成本（积分）
   */
  async calculateCost(inputTokens: number): Promise<number> {
    const config = await this.getSystemConfig();

    if (!config.inputPrice) {
      console.warn('[Embedding] No pricing configured, returning 0 cost');
      return 0;
    }

    // 计算成本：(tokens / 1,000,000) * price_per_million
    const pricePerMillion = parseFloat(config.inputPrice);
    const costUSD = (inputTokens / 1_000_000) * pricePerMillion;

    // 转换为积分（1 USD = 10000积分，应该从系统配置读取）
    // TODO: 从 system_settings 表读取 USD_TO_CREDITS 汇率
    const USD_TO_CREDITS = 10000;
    const credits = Math.ceil(costUSD * USD_TO_CREDITS);

    return credits;
  }

  /**
   * 记录embedding使用并扣除积分
   */
  async logUsageAndDeductCredits(params: {
    chunkCount?: number;
    fileId?: string;
    inputTokens: number;
    operationType: 'file_chunking' | 'semantic_search' | 'rag_eval';
    userId: string;
  }): Promise<{ cost: number; success: boolean }> {
    const config = await this.getSystemConfig();
    const cost = await this.calculateCost(params.inputTokens);

    try {
      // Step 1: 扣除用户积分
      if (cost > 0) {
        const { UserBalanceService } = await import('../user/balance');
        const balanceService = new UserBalanceService(this.db, params.userId);

        await balanceService.deductBalance({
          amount: cost,
          category: 'EMBEDDING_USAGE',
          description: `Embedding generation: ${params.inputTokens} tokens`,
        });
      }

      // Step 2: 记录使用日志
      await this.db.insert(embeddingUsageLogs).values({
        chunkCount: params.chunkCount,
        costPrice: cost.toFixed(4),
        fileId: params.fileId,
        inputTokens: params.inputTokens,
        modelId: config.modelId,
        operationType: params.operationType,
        providerId: config.providerId,
        totalTokens: params.inputTokens, // Embedding没有output tokens
        userId: params.userId,
        userPrice: cost.toFixed(4),
      });

      return { cost, success: true };
    } catch (error) {
      console.error('[Embedding] Failed to log usage and deduct credits:', error);
      throw error;
    }
  }
}
```

#### Step 3: 修改文件分块嵌入逻辑

**文件**: `src/server/routers/async/file.ts` (第44-147行)

**当前代码**:
```typescript
const embeddings = await agentRuntime.embeddings({
  dimensions: 1024,
  input: chunks.map((c) => c.text),
  model: modelId,
});
```

**修改为**:
```typescript
// 调用embedding API
const result = await agentRuntime.embeddings({
  dimensions: 1024,
  input: chunks.map((c) => c.text),
  model: modelId,
});

const { embeddings, usage } = result;

// 记录使用并扣除积分
const embeddingService = new EmbeddingService(ctx.serverDB);
await embeddingService.logUsageAndDeductCredits({
  chunkCount: chunks.length,
  fileId: input.fileId,
  inputTokens: usage.promptTokens,
  operationType: 'file_chunking',
  userId: ctx.userId,
});

// 保存embeddings到数据库
await ctx.embeddingModel.bulkCreate(
  chunks.map((chunk, i) => ({
    chunkId: chunk.id,
    clientId: input.clientId,
    embeddings: embeddings[i],
    model: modelId,
    userId: ctx.userId,
  })),
);
```

#### Step 4: 修改语义搜索逻辑

**文件**: `src/server/routers/lambda/chunk.ts` (第256-337行)

在 `semanticSearchForChat` mutation中添加：

```typescript
// 生成查询embedding
const result = await agentRuntime.embeddings({
  dimensions: 1024,
  input: input.query,
  model: modelId,
});

const { embeddings, usage } = result;

// 记录使用并扣除积分
const embeddingService = new EmbeddingService(ctx.serverDB);
await embeddingService.logUsageAndDeductCredits({
  inputTokens: usage.promptTokens,
  operationType: 'semantic_search',
  userId: ctx.userId,
});

// 执行语义搜索
const chunks = await ctx.chunkModel.semanticSearchForChat({
  embedding: embeddings[0],
  fileIds: finalFileIds,
  topK: input.topK,
});
```

#### Step 5: 修改RAG评估逻辑

**文件**: `src/server/routers/async/ragEval.ts` (第68-73行)

类似地添加usage记录和积分扣除逻辑。

#### Step 6: 创建UserBalanceService方法

如果 `UserBalanceService` 还没有 `deductBalance` 方法，需要添加：

**文件**: `src/server/services/user/balance.ts` (可能需要创建)

```typescript
import { LobeChatDatabase, userBalances, userTransactions } from '@lobechat/database';
import { eq } from 'drizzle-orm';
import { idGenerator } from '@lobechat/database';

export class UserBalanceService {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  /**
   * 扣除用户余额
   */
  async deductBalance(params: {
    amount: number;
    category: string;
    description: string;
  }): Promise<void> {
    // 查询当前余额
    const [balance] = await this.db
      .select()
      .from(userBalances)
      .where(eq(userBalances.userId, this.userId))
      .limit(1);

    if (!balance) {
      throw new Error('User balance not found');
    }

    const currentBalance = parseFloat(balance.balance);
    if (currentBalance < params.amount) {
      throw new Error('Insufficient balance');
    }

    const newBalance = currentBalance - params.amount;

    // 更新余额
    await this.db
      .update(userBalances)
      .set({ balance: newBalance.toFixed(4) })
      .where(eq(userBalances.userId, this.userId));

    // 记录交易
    await this.db.insert(userTransactions).values({
      amount: (-params.amount).toFixed(4),
      balanceAfter: newBalance.toFixed(4),
      category: params.category,
      description: params.description,
      id: idGenerator('tx'),
      type: params.category,
      userId: this.userId,
    });
  }
}
```

### 测试步骤

1. **配置Embedding**: 在后台管理界面配置OpenRouter的Qwen embedding模型
2. **上传文件**: 在主项目上传一个文档到知识库
3. **检查余额**: 验证用户余额是否被扣除
4. **查看日志**: 在 `embedding_usage_logs` 表中验证记录
5. **语义搜索**: 执行知识库搜索，验证搜索也扣除积分
6. **余额不足**: 测试余额为0时是否正确拒绝操作

### 关键注意事项

⚠️ **重要**:
- 所有embedding操作都必须包裹在事务中
- 积分扣除失败应该回滚embedding操作
- 需要处理并发扣除的情况（使用数据库锁）
- 考虑批量操作的积分预检查（避免处理到一半余额不足）

---

## Phase 3: 高级优化功能 (可选)

### 3.1 多模型支持

**需求**: 不同场景使用不同的embedding模型

**实现**:
```typescript
// 扩展 system_embedding_config 表为多行表
ALTER TABLE system_embedding_config
  DROP CONSTRAINT system_embedding_config_pkey,
  ADD COLUMN scenario VARCHAR(50) NOT NULL DEFAULT 'default',
  ADD PRIMARY KEY (id, scenario);

// 支持的场景
enum EmbeddingScenario {
  DEFAULT = 'default',       // 默认
  HIGH_QUALITY = 'quality',  // 高质量（文档归档）
  FAST = 'fast',            // 快速（实时搜索）
  MULTILINGUAL = 'multi',   // 多语言
}
```

### 3.2 Embedding缓存

**需求**: 相同文本不重复生成embedding

**实现**:
```sql
CREATE TABLE embedding_cache (
  id SERIAL PRIMARY KEY,
  text_hash VARCHAR(64) UNIQUE NOT NULL,  -- SHA256(text)
  model_id VARCHAR(200) NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_embedding_cache_hash ON embedding_cache(text_hash);
CREATE INDEX idx_embedding_cache_last_used ON embedding_cache(last_used_at);
```

**逻辑**:
1. 生成embedding前先检查缓存
2. 命中缓存则不调用API，不扣除积分
3. 定期清理90天未使用的缓存

### 3.3 批量嵌入失败重试

**需求**: 大文件嵌入失败不浪费已消耗的token

**实现**:
- 记录每批次的embedding进度
- 失败后从断点继续，而不是从头开始
- 提供手动重试接口

### 3.4 成本预估和限制

**需求**: 上传文件前告知用户预计消耗

**实现**:
```typescript
// API: POST /api/file/estimate-embedding-cost
async estimateEmbeddingCost(params: {
  fileSize: number;
  fileType: string;
}) {
  // 根据文件类型和大小估算chunk数量
  const estimatedChunks = estimateChunkCount(params.fileSize, params.fileType);

  // 估算token数量（每个chunk平均500 tokens）
  const estimatedTokens = estimatedChunks * 500;

  // 计算成本
  const embeddingService = new EmbeddingService(db);
  const cost = await embeddingService.calculateCost(estimatedTokens);

  return {
    estimatedChunks,
    estimatedTokens,
    estimatedCost: cost,
  };
}
```

### 3.5 实时成本监控

**需求**: 管理员实时查看embedding成本

**实现**:
- 在Dashboard添加embedding成本统计卡片
- 显示今日/本周/本月的embedding消耗
- Top用户排行
- 成本趋势图表

---

## 数据流程图

```
┌─────────────┐
│   用户      │
│  上传文件   │
└──────┬──────┘
       │
       v
┌─────────────────────┐
│  文件分块          │
│  (ChunkService)    │
└──────┬──────────────┘
       │
       v
┌─────────────────────────────────────┐
│  生成Embeddings                     │
│  1. 调用 agentRuntime.embeddings() │
│  2. 返回 {embeddings, usage}        │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│  EmbeddingService                   │
│  1. 获取系统配置                    │
│  2. 计算成本 (tokens * price)       │
│  3. 扣除用户积分                    │
│  4. 记录使用日志                    │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────┐
│  保存到数据库       │
│  - embeddings表     │
│  - chunks表         │
└─────────────────────┘
```

---

## 关键配置参数

| 参数名 | 位置 | 默认值 | 说明 |
|-------|------|-------|------|
| `USD_TO_CREDITS` | 系统配置 | 10000 | 美元到积分的汇率 |
| `DEFAULT_CHUNK_SIZE` | 文件处理 | 500 | 默认chunk大小（tokens） |
| `EMBEDDING_DIMENSIONS` | Embedding配置 | 1024 | Embedding向量维度 |
| `EMBEDDING_BATCH_SIZE` | 文件处理 | 50 | 批量embedding的批次大小 |

---

## 常见问题

### Q1: 为什么要单独配置Embedding模型？

**A**: 因为embedding模型和chat模型有本质区别：
- Embedding模型不应该在对话界面中显示给用户
- Embedding是后台自动调用的，用户无感知
- 定价模型完全不同（只有输入价格，没有输出价格）

### Q2: 如何处理余额不足的情况？

**A**:
1. 文件上传阶段先预估成本
2. 如果余额不足，直接拒绝上传
3. 批量处理中途余额不足，保存已处理的部分，标记任务为"部分完成"

### Q3: Embedding缓存会不会占用太多空间？

**A**:
- 1024维的vector大约占用4KB
- 100万条缓存约占4GB
- 通过LRU策略定期清理不常用的缓存
- 可配置缓存大小上限

### Q4: 如何验证积分扣除的正确性？

**A**:
1. 查看 `embedding_usage_logs` 表的记录
2. 对比 `userBalances` 表的变化
3. 检查 `userTransactions` 表的交易记录
4. 在后台管理界面查看用户的使用明细

---

## 实施时间线建议

| 阶段 | 预计时间 | 优先级 |
|------|---------|--------|
| Phase 1 (配置系统) | ✅ 已完成 | P0 (必须) |
| Phase 2 (积分扣除) | 2-3天 | P0 (必须) |
| Phase 3.1 (多模型) | 1天 | P2 (可选) |
| Phase 3.2 (缓存) | 2天 | P1 (推荐) |
| Phase 3.3 (重试) | 1天 | P2 (可选) |
| Phase 3.4 (成本预估) | 1天 | P1 (推荐) |
| Phase 3.5 (监控) | 2天 | P1 (推荐) |

**建议**: Phase 2必须尽快实施，否则会造成实际成本损失。Phase 3可以根据实际需求逐步实施。

---

## 相关文件清单

### Phase 1 (已创建)

- `packages/database/migrations/0071_add_system_embedding_config.sql`
- `packages/database/src/schemas/systemEmbedding.ts`
- `admin-system/server/src/routes/system-embedding.ts`
- `admin-system/src/pages/SystemConfig/Embedding/index.tsx`
- `admin-system/src/services/system-embedding.ts`
- `admin-system/config/routes.ts` (已修改)
- `admin-system/src/locales/zh-CN/menu.ts` (已修改)
- `admin-system/src/locales/en-US/menu.ts` (已修改)

### Phase 2 (待创建/修改)

- `packages/model-runtime/src/core/openaiCompatibleFactory/index.ts` (修改)
- `src/server/services/embedding/index.ts` (新建)
- `src/server/services/user/balance.ts` (新建或修改)
- `src/server/routers/async/file.ts` (修改)
- `src/server/routers/lambda/chunk.ts` (修改)
- `src/server/routers/async/ragEval.ts` (修改)

### Phase 3 (待创建)

- 根据实际选择的功能创建

---

## 联系人

如有疑问，请联系：
- 技术负责人: [待补充]
- 数据库管理员: [待补充]

---

**文档版本**: v1.0
**最后更新**: 2026-01-13
