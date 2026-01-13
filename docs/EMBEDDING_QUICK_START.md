# Embedding配置快速开始

## 🚀 5分钟快速配置

### Step 1: 访问配置页面
```
后台管理 → 系统配置 → Embedding配置
```

### Step 2: OpenRouter配置（推荐）

| 字段 | 填写内容 |
|-----|---------|
| 供应商 | `openrouter` |
| API Key | 你的OpenRouter API Key |
| Base URL | `https://openrouter.ai/api/v1` |
| 模型同步地址 | `https://openrouter.ai/api/v1/embeddings/models` ⚠️ |

⚠️ **重要**: 必须使用 `/embeddings/models` 而不是 `/models`

### Step 3: 同步模型
点击"同步模型列表"按钮

### Step 4: 选择模型
推荐：`qwen/qwen3-embedding-4b`（性价比最高）

### Step 5: 保存
点击"保存配置"

---

## ✅ 验证

打开浏览器开发者工具，查看Network请求：
- 同步请求应该访问 `https://openrouter.ai/api/v1/embeddings/models`
- 返回的应该都是embedding类型的模型

查看后端日志：
```bash
[Embedding] Syncing models from: https://openrouter.ai/api/v1/embeddings/models
[Embedding] Found 5 embedding models
[Embedding] Syncing models: qwen/qwen3-embedding-4b, qwen/qwen3-embedding-8b, ...
```

---

## ❌ 常见错误

### 错误1: 使用了错误的同步地址
```
❌ https://openrouter.ai/api/v1/models           (这是chat模型)
✅ https://openrouter.ai/api/v1/embeddings/models (这是embedding模型)
```

### 错误2: Base URL错误
```
❌ https://openrouter.ai/api/v1/embeddings       (不要包含/embeddings)
✅ https://openrouter.ai/api/v1                   (正确的Base URL)
```

SDK会自动添加 `/embeddings` endpoint，最终调用: `https://openrouter.ai/api/v1/embeddings`

### 错误3: 找不到模型
**原因**: 没有提供API Key
**解决**: 在"API Key"字段填写你的OpenRouter key

---

## 📊 推荐配置

### 预算有限
- **模型**: `qwen/qwen3-embedding-8b`
- **价格**: $0.01/M tokens（最便宜）
- **上下文**: 32k

### 平衡选择（推荐）
- **模型**: `qwen/qwen3-embedding-4b`
- **价格**: $0.02/M tokens
- **上下文**: 32k

### 最高质量
- **模型**: `openai/text-embedding-3-large`
- **价格**: $0.13/M tokens
- **上下文**: 8k

---

## ⚠️ 重要提醒

当前Phase 1只完成了配置系统，**还不会自动扣除积分**！

查看 [EMBEDDING_IMPLEMENTATION_PLAN.md](./EMBEDDING_IMPLEMENTATION_PLAN.md) 实施Phase 2。

---

## 🔗 相关文档

- [详细配置说明](./OPENROUTER_EMBEDDING_SETUP.md)
- [完整实施计划](./EMBEDDING_IMPLEMENTATION_PLAN.md)
- [OpenRouter官方文档](https://openrouter.ai/docs/api/reference/embeddings)
