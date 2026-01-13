# OpenRouter Embedding配置说明

> **文档目的**: 说明如何正确配置OpenRouter的embedding模型
> **创建日期**: 2026-01-13

## 配置步骤

### 1. 准备API Key

访问 [OpenRouter](https://openrouter.ai/) 获取API Key。

### 2. 后台配置

在后台管理界面 `系统配置 > Embedding配置` 中填写：

| 字段 | 值 | 说明 |
|-----|---|------|
| 供应商 | `openrouter` | 选择OpenRouter |
| API Key | `sk-or-v1-xxx...` | 你的OpenRouter API Key |
| Base URL | `https://openrouter.ai/api/v1` | **与chat模型相同** |
| 模型同步地址 | `https://openrouter.ai/api/v1/embeddings/models` | **专门的embedding模型列表API** |

### 3. 同步模型列表

点击"同步模型列表"按钮，系统会：
1. 调用 `https://openrouter.ai/api/v1/embeddings/models` 获取embedding模型（**专门的embedding endpoint**）
2. 筛选和验证模型列表
3. 保存到数据库中供选择

### 4. 选择模型

推荐的embedding模型：

| 模型ID | 价格 | 上下文 | 适用场景 |
|--------|------|-------|---------|
| `qwen/qwen3-embedding-4b` | $0.02/M tokens | 32k | 通用，性价比高 |
| `qwen/qwen3-embedding-8b` | $0.01/M tokens | 32k | 更便宜，稍慢 |
| `openai/text-embedding-3-small` | $0.02/M tokens | 8k | OpenAI官方，质量高 |
| `openai/text-embedding-3-large` | $0.13/M tokens | 8k | 最高质量 |

## 重要说明

### Base URL是否和chat模型一样？

**是的！** OpenRouter的embedding和chat使用相同的Base URL：`https://openrouter.ai/api/v1`

区别在于调用的**endpoint**：
- Chat模型：`POST /api/v1/chat/completions`
- Embedding模型：`POST /api/v1/embeddings`

### 模型同步地址

OpenRouter提供了**专门的embedding模型列表endpoint**：
```
GET https://openrouter.ai/api/v1/embeddings/models
```

这个endpoint只返回embedding模型，不需要额外筛选。

**注意**: 不要使用通用的 `/api/v1/models` endpoint，那个返回的主要是chat模型，embedding模型数量很少或没有。

### 如何验证配置

同步完成后，检查后端日志：

```
[Embedding] Syncing models from: https://openrouter.ai/api/v1/embeddings/models
[Embedding] Found 5 embedding models out of 5 total
[Embedding] Syncing models: qwen/qwen3-embedding-4b, qwen/qwen3-embedding-8b, ...
```

如果看到 `Found 0 embedding models`，说明：
1. **使用了错误的endpoint**：应该用 `/embeddings/models` 而不是 `/models`
2. 可能没有传API Key（OpenRouter需要认证才能看到完整模型列表）
3. 网络问题或API暂时不可用

## OpenRouter API调用示例

### Chat Completion（参考）
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Embeddings（实际使用）
```bash
curl https://openrouter.ai/api/v1/embeddings \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen3-embedding-4b",
    "input": "Hello world"
  }'
```

注意：
- **相同的Base URL**：`https://openrouter.ai/api/v1`
- **不同的endpoint**：`/chat/completions` vs `/embeddings`
- **相同的认证方式**：都使用 `Authorization: Bearer` header

## 可用的Embedding模型

访问 [OpenRouter Embedding Models](https://openrouter.ai/models?fmt=cards&output_modalities=embeddings) 查看最新的embedding模型列表。

当前（2026-01）可用的主要模型：

1. **Qwen系列** (Alibaba)
   - `qwen/qwen3-embedding-4b` - 4B参数，32k上下文
   - `qwen/qwen3-embedding-8b` - 8B参数，32k上下文
   - 价格低廉，中英文效果好

2. **OpenAI系列**
   - `openai/text-embedding-3-small` - 轻量级，8k上下文
   - `openai/text-embedding-3-large` - 高质量，8k上下文
   - 价格较高，质量稳定

3. **其他供应商**
   - Voyage AI
   - Cohere
   - Jina AI

## 常见问题

### Q1: 为什么同步后没有找到模型？

可能原因：
1. **没有提供API Key**：OpenRouter要求认证才能访问完整模型列表
2. **模型被筛选掉了**：检查后端日志中的"Sample models"输出
3. **网络问题**：无法访问OpenRouter API

解决方法：
- 确保填写了正确的API Key
- 查看后端日志的调试信息
- 尝试在浏览器直接访问 `https://openrouter.ai/api/v1/models` 验证API可用性

### Q2: Base URL填错会怎样？

如果填写了错误的Base URL：
- 模型同步会失败（404或其他错误）
- Embedding调用会失败
- 后端日志会显示连接错误

### Q3: 可以使用其他供应商吗？

可以！只要供应商提供OpenAI兼容的API，就可以配置：

**OpenAI官方**:
- Base URL: `https://api.openai.com/v1`
- 同步地址: `https://api.openai.com/v1/models`

**Azure OpenAI**:
- Base URL: `https://{your-resource}.openai.azure.com/openai/deployments/{deployment-id}`
- 同步地址: 手动添加模型（Azure不提供models列表API）

**自建代理**:
- 如果你有自己的OpenRouter代理，填写代理地址即可

## 下一步

配置完成后，请阅读 [EMBEDDING_IMPLEMENTATION_PLAN.md](./EMBEDDING_IMPLEMENTATION_PLAN.md) 了解如何实施Phase 2（积分扣除功能）。

---

## 参考链接

- [OpenRouter Embeddings API文档](https://openrouter.ai/docs/api/reference/embeddings)
- [OpenRouter Embedding模型列表](https://openrouter.ai/models?fmt=cards&output_modalities=embeddings)
- [OpenRouter TypeScript SDK](https://openrouter.ai/docs/sdks/typescript/embeddings)

---

**文档版本**: v1.0
**最后更新**: 2026-01-13
