# 模型同步功能实现摘要

## 概览

实现统一的模型同步功能，支持从 API 或 model-bank 同步模型列表和定价。

## 核心逻辑

### 判断规则（简化版）

```typescript
// 统一的同步逻辑
if (provider.pricingApiUrl && provider.pricingApiUrl.trim()) {
  // 有 API URL -> 尝试 API 同步
  try {
    return await syncFromAPI(provider);
  } catch (error) {
    console.warn('API同步失败，降级到 model-bank:', error);
    // 降级到 model-bank
    return await syncFromModelBank(provider);
  }
} else {
  // 没有 API URL -> model-bank 同步
  return await syncFromModelBank(provider);
}
```

## 数据库更改

### 新增字段（已完成）

**表**: `ai_providers` 和 `protochat_providers`

| 字段 | 类型 | 说明 |
|------|------|------|
| `pricing_sync_strategy` | varchar(50) | 同步策略（保留用于显示） |
| `pricing_api_url` | varchar(500) | API 同步地址（核心判断字段） |

### 迁移 SQL

📄 文件: `packages/database/migrations/0065_add_pricing_sync_fields_to_ai_providers.sql`

**执行方式**:
```bash
psql -U your_username -d your_database -f packages/database/migrations/0065_add_pricing_sync_fields_to_ai_providers.sql
```

## 前端UI改动

### 1. 子供应商详情页
**位置**: `admin-system/src/pages/ProtoChat/Providers/Detail/index.tsx`

添加表单项：
```tsx
<Form.Item label="在线同步地址 (API URL)" name="pricingApiUrl">
  <Input
    placeholder="例如: https://openrouter.ai/api/v1/models"
  />
  <Text type="secondary">
    如果填写了API地址，将优先从API同步模型；否则使用model-bank数据
  </Text>
</Form.Item>
```

### 2. 全局服务商详情页
**位置**: `admin-system/src/pages/AiProviders/Detail/index.tsx`

添加同样的表单项（如上）。

### 3. 同步按钮
在模型列表上方添加：
```tsx
<Button
  type="primary"
  icon={<SyncOutlined />}
  onClick={handleSyncModels}
  loading={syncing}
>
  同步最新模型列表
</Button>
```

## 后端端点

### POST /api/admin/protochat/providers/:id/sync
**说明**: 子供应商模型同步

**逻辑**:
1. 查询供应商配置
2. 检查 `pricingApiUrl`
3. 有 URL → API 同步，失败则降级
4. 无 URL → model-bank 同步

### POST /api/admin/ai-providers/:id/sync (新增)
**说明**: 全局服务商模型同步

**逻辑**: 与子供应商相同

## API 适配器

### OpenRouter 适配器

**URL**: `https://openrouter.ai/api/v1/models`

**数据映射**:
```typescript
{
  id: "openai/gpt-5.2",
  name: "GPT-5.2",
  pricing: {
    prompt: 0.00000175,      // USD/token
    completion: 0.000014     // USD/token
  },
  architecture: {
    context_length: 128000,
    max_completion_tokens: 64000,
    modality: "text+image->text"
  }
}

// 映射到系统格式
{
  protochatId: "protochat::gpt-5.2",
  originalId: "openrouter::openai/gpt-5.2",
  displayName: "GPT-5.2",
  costInputPrice: 1.75,     // USD/million tokens
  costOutputPrice: 14.0,    // USD/million tokens
  contextTokens: 128000,
  maxOutput: 64000
}
```

## 示例配置

### OpenRouter（推荐）

```json
{
  "id": "openrouter",
  "name": "OpenRouter",
  "pricingApiUrl": "https://openrouter.ai/api/v1/models"
}
```

点击"同步模型列表"→ 调用 OpenRouter API → 导入所有模型和定价

### DeepSeek（model-bank）

```json
{
  "id": "deepseek",
  "name": "DeepSeek",
  "pricingApiUrl": ""
}
```

点击"同步模型列表"→ 使用 model-bank 数据 → 导入模型

## 优势

1. ✅ **简单**: 只看 `pricingApiUrl` 有没有值
2. ✅ **灵活**: 支持任何供应商的 API（只需填URL）
3. ✅ **容错**: API 失败自动降级到 model-bank
4. ✅ **扩展**: 未来新供应商只需填写 API URL
5. ✅ **统一**: 子供应商和全局服务商逻辑完全一致

## 待办事项

- [ ] 执行数据库迁移 SQL
- [ ] 实现后端同步逻辑（protochat 和 ai-providers）
- [ ] 创建 OpenRouter API 适配器
- [ ] 前端添加 API URL 输入框
- [ ] 前端添加同步按钮
- [ ] 测试完整流程
