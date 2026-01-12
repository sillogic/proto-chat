# ProtoChat路由修复

## 问题描述

用户在对话窗口中选择ProtoChat的模型后进行对话，系统提示需要配置OpenAI的key。

## 根本原因

ProtoChat是一个"套壳"供应商，它根据用户选择的模型动态路由到实际的子供应商（如OpenRouter、DeepSeek等）。

问题出在模型运行时初始化流程：

```typescript
// ❌ 错误的流程
1. 初始化 ModelRuntime (此时不知道model ID)
2. 读取请求body (包含model信息)
3. 调用 runtime.chat(data)

// ProtoChat需要在初始化时就知道model ID
// 因为不同的model对应不同的子供应商和API key
```

在 `src/server/modules/ModelRuntime/index.ts` 中的 `initProtoChatRuntime` 函数：

```typescript
const initProtoChatRuntime = async (payload: ClientSecretPayload, params: any = {}) => {
  const modelId = params?.model; // ❌ params是空对象，modelId为undefined

  if (!modelId) {
    throw new Error('Model ID is required for ProtoChat provider');
  }

  // 1. 查询模型映射（从数据库）
  const mapping = await protochatService.getModelMapping(modelId);

  // 2. 获取实际的子供应商API key和baseURL
  const runtimeParams = {
    apiKey: mapping.apiKey,
    baseURL: mapping.baseUrl,
    model: actualModelId,
  };

  // 3. 使用子供应商初始化Runtime
  return ModelRuntime.initializeWithProvider(runtimeProvider, runtimeParams);
};
```

因为在调用 `initModelRuntimeWithUserPayload` 时没有传递model参数，导致ProtoChat无法查询子供应商配置，系统fallback到默认的OpenAI provider。

## 解决方案

修改所有调用 `initModelRuntimeWithUserPayload` 的地方，**在读取请求数据之后**再初始化runtime，并传递model参数。

### ✅ 正确的流程

```typescript
// ✅ 正确的流程
1. 读取请求body (获取model信息)
2. 初始化 ModelRuntime (传递model参数)
3. 调用 runtime.chat(data)
```

## 修改的文件

### 1. Chat API路由
**文件**: `src/app/(backend)/webapi/chat/[provider]/route.ts`

```typescript
// Before
const provider = (await params)!.provider!;
const modelRuntime = await initModelRuntimeWithUserPayload(provider, jwtPayload);
const data = (await req.json()) as ChatStreamPayload;

// After
const provider = (await params)!.provider!;
const data = (await req.json()) as ChatStreamPayload; // 先读取body
const modelRuntime = await initModelRuntimeWithUserPayload(
  provider,
  jwtPayload,
  { model: data.model } // 传递model参数
);
```

### 2. Text-to-Image API路由
**文件**: `src/app/(backend)/webapi/text-to-image/[provider]/route.ts`

```typescript
// After
const data = (await req.json()) as TextToImagePayload; // 先读取body
const agentRuntime = await initModelRuntimeWithUserPayload(
  provider,
  jwtPayload,
  { model: data.model } // 传递model参数
);
```

### 3. tRPC AI Chat路由
**文件**: `src/server/routers/lambda/aiChat.ts`

```typescript
// After
const modelRuntime = await initModelRuntimeWithUserPayload(
  input.provider,
  payload,
  { model: input.model } // 传递model参数从input
);
```

### 4. 文件Embedding路由
**文件**: `src/server/routers/async/file.ts`

```typescript
// After
const { model, provider } = getServerDefaultFilesConfig().embeddingModel || DEFAULT_FILE_EMBEDDING_MODEL_ITEM;
const agentRuntime = await initModelRuntimeWithUserPayload(
  provider,
  ctx.jwtPayload,
  { model } // 传递model参数
);
```

### 5. 图片生成路由
**文件**: `src/server/routers/async/image.ts`

```typescript
// After
const { taskId, generationId, provider, model, params } = input;
const agentRuntime = await initModelRuntimeWithUserPayload(
  provider,
  ctx.jwtPayload,
  { model } // 传递model参数
);
```

### 6. Chunk语义搜索路由
**文件**: `src/server/routers/lambda/chunk.ts`

两处修改：
```typescript
// 第一处
const { model, provider } = getServerDefaultFilesConfig().embeddingModel || DEFAULT_FILE_EMBEDDING_MODEL_ITEM;
const agentRuntime = await initModelRuntimeWithUserPayload(
  provider,
  ctx.jwtPayload,
  { model } // 传递model参数
);

// 第二处
const modelRuntime = await initModelRuntimeWithUserPayload(
  provider,
  providerDetail.keyVaults || {},
  { model } // 传递model参数
);
```

### 7. RAG评估路由
**文件**: `src/server/routers/async/ragEval.ts`

```typescript
// After
const { question, languageModel, embeddingModel } = evalRecord;
const model = embeddingModel || DEFAULT_EMBEDDING_MODEL;
const agentRuntime = await initModelRuntimeWithUserPayload(
  ModelProvider.OpenAI,
  ctx.jwtPayload,
  { model } // 传递model参数
);
```

## ProtoChat路由逻辑

当provider为 `protochat` 时，`initModelRuntimeWithUserPayload` 会：

1. **检测ProtoChat供应商**
   ```typescript
   if (ProtoChatService.isProtoChatProvider(provider)) {
     return await initProtoChatRuntime(payload, params);
   }
   ```

2. **查询模型映射**
   ```typescript
   // 从数据库查询 protochat_models 表
   const mapping = await protochatService.getModelMapping(modelId);
   // 返回: { originalId, originalProvider, apiKey, baseUrl }
   ```

3. **转换模型ID**
   ```typescript
   // 'openrouter::openai/gpt-4o' → 'openai/gpt-4o'
   const actualModelId = protochatService.convertModelId(mapping.originalId);
   ```

4. **初始化子供应商Runtime**
   ```typescript
   // 使用子供应商的API key和baseURL
   return ModelRuntime.initializeWithProvider(runtimeProvider, {
     apiKey: mapping.apiKey,      // 从数据库获取
     baseURL: mapping.baseUrl,    // 从数据库获取
     model: actualModelId,         // 转换后的模型ID
   });
   ```

## 数据流示例

### 用户使用ProtoChat的glm-4.6模型

```
用户 → 选择 protochat::glm-4.6 → 发送消息
         ↓
1. 前端发送请求
   POST /webapi/chat/protochat
   Body: { model: "protochat::glm-4.6", messages: [...] }
         ↓
2. 后端读取body，提取model
   model = "protochat::glm-4.6"
         ↓
3. 初始化Runtime (传递model参数)
   initModelRuntimeWithUserPayload("protochat", jwtPayload, { model })
         ↓
4. 检测到ProtoChat，查询数据库
   SELECT * FROM protochat_models WHERE id = "protochat::glm-4.6"
   → originalId: "zhipu::glm-4.6"
   → originalProvider: "zhipu"
         ↓
5. 查询子供应商配置
   SELECT * FROM protochat_providers WHERE id = "zhipu"
   → apiKey: "xxx"
   → baseUrl: "https://open.bigmodel.cn/api/paas/v4"
         ↓
6. 转换模型ID
   "zhipu::glm-4.6" → "glm-4.6"
         ↓
7. 初始化ZhiPu Runtime
   ModelRuntime.initializeWithProvider("zhipu", {
     apiKey: "xxx",
     baseURL: "https://open.bigmodel.cn/api/paas/v4",
     model: "glm-4.6"
   })
         ↓
8. 调用ZhiPu API
   ✅ 成功返回结果
```

### 如果不传递model参数（修复前）

```
用户 → 选择 protochat::glm-4.6 → 发送消息
         ↓
1. 前端发送请求
         ↓
2. 后端初始化Runtime (没有model参数)
   initModelRuntimeWithUserPayload("protochat", jwtPayload) // ❌ params = {}
         ↓
3. initProtoChatRuntime执行
   const modelId = params?.model; // undefined
   if (!modelId) throw new Error(...) // ❌ 抛出错误
         ↓
4. 或者fallback到默认provider
   → 使用OpenAI provider
   → 提示: "请配置OpenAI API key" ❌
```

## 验证方法

1. **启动开发服务器**
   ```bash
   bun run dev
   ```

2. **选择ProtoChat模型**
   - 打开对话窗口
   - 选择ProtoChat供应商的任意模型（如 glm-4.6）

3. **发送消息**
   - 输入任意消息并发送
   - 应该正常返回AI回复，不会提示配置OpenAI key

4. **检查日志**
   ```
   [ProtoChat] Routing model protochat::glm-4.6 to zhipu::glm-4.6
   ```

## 相关文件

- `src/server/modules/ModelRuntime/index.ts` - Runtime初始化逻辑
- `src/server/services/protochat/index.ts` - ProtoChat服务（模型映射查询）
- `src/app/(backend)/webapi/chat/[provider]/route.ts` - Chat API路由
- `src/app/(backend)/webapi/text-to-image/[provider]/route.ts` - 图片生成API路由
- `src/server/routers/lambda/aiChat.ts` - tRPC AI Chat路由
- `src/server/routers/async/file.ts` - 文件Embedding路由
- `src/server/routers/async/image.ts` - 图片生成异步路由
- `src/server/routers/lambda/chunk.ts` - Chunk语义搜索路由
- `src/server/routers/async/ragEval.ts` - RAG评估路由

## 总结

这次修复确保了：
- ✅ ProtoChat能够正确获取model ID
- ✅ 能够查询数据库获取子供应商配置
- ✅ 能够使用正确的API key和baseURL调用子供应商API
- ✅ 用户不需要配置任何API key，直接使用ProtoChat模型

**关键原则**: 对于ProtoChat这种需要动态路由的provider，必须在初始化runtime之前就知道model ID。
