# 计费逻辑说明

## 概述

系统采用简化的计费模型：
- **只对全局服务商（ProtoChat）计费**
- **用户自己配置的服务商不计费**

## 架构设计

### 全局服务商 vs 用户服务商

| 类型 | is_global | 管理方 | 计费 | API Key来源 |
|------|-----------|--------|------|-------------|
| 全局服务商 | true | 系统管理员 | ✅ 计费 | 系统提供 |
| 用户服务商 | false | 用户自己 | ❌ 不计费 | 用户提供 |

当前系统中：
- **全局服务商**: 只有 ProtoChat
- **用户服务商**: 用户可以自行添加任何provider（OpenAI、Anthropic等）

## 计费流程

### 1. 消息创建和Token统计

用户发送消息 → AI模型响应 → 计算输入/输出Token

```typescript
// 在 src/server/services/message/index.ts
async updateMetadata(id: string, value: any) {
  await this.messageModel.updateMetadata(id, value);
  await this.handleCreditDeduction(id, value); // 触发计费
}
```

### 2. 判断是否计费

```typescript
private async handleCreditDeduction(id: string, incomingMetadata: any) {
  const { totalInputTokens, totalOutputTokens } = incomingMetadata;

  if (totalInputTokens || totalOutputTokens) {
    const message = await this.messageModel.findById(id);

    // 关键判断：用户是否使用自己的API key
    const isUserConfig = await this.isUserUsingOwnConfig(message.provider);

    const cost = await this.creditService.calculateCost(
      message.model,
      message.provider,
      totalInputTokens || 0,
      totalOutputTokens || 0,
      isUserConfig  // 如果是用户配置，cost会返回0
    );

    if (cost > 0) {
      await this.creditService.deductCredits(cost, ...);
    }
  }
}
```

### 3. 判断逻辑详解

```typescript
private async isUserUsingOwnConfig(provider: string): Promise<boolean> {
  // 查询用户是否有该provider的个人配置（is_global=false）
  const userConfig = await this.db.query.aiProviders.findFirst({
    where: and(
      eq(aiProviders.userId, this.userId),
      eq(aiProviders.id, provider),
      eq(aiProviders.isGlobal, false)  // 只查询个人配置
    ),
  });

  if (!userConfig) {
    // 没有个人配置 → 使用全局ProtoChat → 计费
    return false;
  }

  // 有个人配置，检查是否配置了API key
  const keyVaults = safeParseJSON(userConfig.keyVaults);
  if (keyVaults?.apiKey) {
    // 有API key → 使用用户自己的服务 → 不计费
    return true;
  }

  // 有配置但没有API key（异常情况）→ 不计费
  return false;
}
```

### 4. 费用计算

```typescript
// 在 src/server/services/credit/index.ts
async calculateCost(
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
  isUserConfig: boolean = false
) {
  // 如果是用户配置，直接返回0
  if (isUserConfig) {
    console.log(`[Credit] User using own config for ${provider}, no charge`);
    return 0;
  }

  // 查询价格表（只有ProtoChat的模型有价格）
  const pricing = await this.db.query.modelPricings.findFirst({
    where: and(
      eq(modelPricings.model, model),
      eq(modelPricings.provider, provider)
    ),
  });

  if (!pricing) {
    console.warn(`[Credit] No pricing found for ${provider}::${model}, no charge`);
    return 0;
  }

  // 计算费用：价格 × Token数量
  const cost =
    (inputTokens / 1_000_000) * parseFloat(pricing.userInputPrice) +
    (outputTokens / 1_000_000) * parseFloat(pricing.userOutputPrice) +
    parseFloat(pricing.perRequestPrice || '0');

  return cost;
}
```

## 使用场景

### 场景1：用户使用全局ProtoChat

```
用户 → 选择ProtoChat模型 → 发送消息
         ↓
检查: 用户没有配置ProtoChat (is_global=false)
         ↓
判断: isUserConfig = false
         ↓
查询: modelPricings表 → 找到价格
         ↓
结果: ✅ 扣除积分
```

**示例**:
- 用户选择 `glm-4.6` (ProtoChat模型)
- 输入1000 tokens，输出2000 tokens
- 价格：输入 50/M, 输出 100/M
- 费用：(1000/1000000) × 50 + (2000/1000000) × 100 = 0.05 + 0.2 = 0.25 积分

### 场景2：用户自己配置OpenAI

```
用户 → 添加OpenAI配置 → 提供API key → 选择OpenAI模型 → 发送消息
                             ↓
检查: 用户有OpenAI配置 (is_global=false) 且有API key
                             ↓
判断: isUserConfig = true
                             ↓
结果: ❌ 不扣除积分 (直接返回cost=0)
```

**示例**:
- 用户添加OpenAI provider
- 配置自己的API key: `sk-proj-xxxxx`
- 使用 `gpt-4o` 模型
- 费用：0 积分（用户使用自己的API key）

### 场景3：用户自己配置ProtoChat (极少见)

```
用户 → 添加ProtoChat配置 → 提供API key → 选择ProtoChat模型 → 发送消息
                                ↓
检查: 用户有ProtoChat配置 (is_global=false) 且有API key
                                ↓
判断: isUserConfig = true
                                ↓
结果: ❌ 不扣除积分
```

**说明**: 虽然系统提供全局ProtoChat，但如果用户自己配置了ProtoChat并提供API key，
         系统会识别为用户配置，不计费。

## 数据库状态

### 全局服务商（系统管理）

```sql
SELECT * FROM ai_providers WHERE is_global = true;
```

| id | name | user_id | enabled | is_global |
|----|------|---------|---------|-----------|
| protochat | ProtoChat | system_admin | true | true |

### 用户服务商（用户自己配置）

```sql
SELECT * FROM ai_providers WHERE user_id = 'user_xxx' AND is_global = false;
```

| id | name | user_id | enabled | is_global | keyVaults |
|----|------|---------|---------|-----------|-----------|
| openai | OpenAI | user_xxx | true | false | {"apiKey": "sk-..."} |
| anthropic | Anthropic | user_xxx | true | false | {"apiKey": "sk-ant-..."} |

## 模型价格表

只有ProtoChat的模型有价格：

```sql
SELECT model, provider, user_input_price, user_output_price, sub_provider
FROM model_pricings
WHERE provider = 'protochat'
LIMIT 5;
```

| model | provider | user_input_price | user_output_price | sub_provider |
|-------|----------|------------------|-------------------|--------------|
| glm-4.6 | protochat | 50.00 | 100.00 | zhipu |
| gpt-4o | protochat | 250.00 | 500.00 | openrouter |
| claude-3.5-sonnet | protochat | 1500.00 | 7500.00 | openrouter |

**注意**:
- 价格单位：积分/百万Token
- 1美元 = 500,000积分
- 用户价格已预先计算好（成本价 × 系数）

## 优势

### 1. 简单明确
- 只有一个全局服务商（ProtoChat）
- 计费逻辑清晰：用户配置=不计费，全局配置=计费

### 2. 灵活性
- 用户可以自由添加任何provider
- 用户可以选择使用系统提供的ProtoChat（计费）或自己的API key（免费）

### 3. 易于维护
- 不需要维护多个全局服务商
- 价格表只需要管理ProtoChat的模型

### 4. 安全性
- 用户的API key加密存储在`keyVaults`字段
- 计费逻辑明确，避免误扣费

## 测试建议

### 测试用例1: 使用ProtoChat应该计费

```javascript
// 1. 创建新用户
// 2. 不配置任何provider
// 3. 使用ProtoChat的glm-4.6模型发送消息
// 4. 检查user_transactions表，应该有扣费记录

// Expected:
// - isUserConfig = false
// - cost > 0
// - 积分余额减少
```

### 测试用例2: 使用自己的OpenAI不应该计费

```javascript
// 1. 创建新用户
// 2. 配置OpenAI provider，提供API key
// 3. 使用OpenAI的gpt-4o模型发送消息
// 4. 检查user_transactions表，应该没有扣费记录

// Expected:
// - isUserConfig = true
// - cost = 0
// - 积分余额不变
```

### 测试用例3: 配置但没有API key

```javascript
// 1. 创建新用户
// 2. 配置OpenAI provider，但不提供API key（或空字符串）
// 3. 尝试使用OpenAI模型
// 4. 应该失败（无法调用API）或不计费

// Expected:
// - isUserConfig = false (没有有效API key)
// - 如果调用失败，不应该扣费
```

## 相关文件

- `src/server/services/message/index.ts` - 消息服务，处理计费触发
- `src/server/services/credit/index.ts` - 积分服务，计算费用和扣费
- `packages/database/src/schemas/aiInfra.ts` - AI服务商数据库schema
- `packages/database/src/schemas/modelPricing.ts` - 模型价格表schema
- `packages/database/src/schemas/userBalance.ts` - 用户余额schema

## 总结

**核心原则**: 用户花钱用自己的 → 不计费；用户用系统的 → 计费

这个简化的计费模型确保了：
- ✅ 只对系统资源（ProtoChat）计费
- ✅ 尊重用户自己的配置（不计费）
- ✅ 逻辑清晰，易于理解和维护
- ✅ 不会出现误扣费的情况
