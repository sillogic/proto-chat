# 图片生成计费重构设计文档

## 背景与问题

### 当前 Bug

| 问题 | 根因 |
|------|------|
| `pricing.image` 被误当图片生成价格 | OpenRouter API 该字段是 vision 输入 per-token 价，不是生成价格 |
| Nano Banana 2 图片生成不收费 | 无 model-bank 条目、API 无 `pricing.image`，`perRequestPrice = 0` |
| Nano Banana Pro 图片生成严重低收 | `pricing.image=0.000002` × 500000 = 1 积分/次，实际应 ~78000 积分 |
| 统计页 type 硬编码 'chat' | 已修复（本次 PR 前置） |
| chargeAfterGenerate 不传真实 token | 已修复（本次 PR 前置），但 outputImageTokens 仍未拆分 |

### 关键确认

1. **视觉识别输入 token**：model runtime 已将图片输入 token 合并进 `totalInputTokens`，chat 管道统一按 `userInputPrice` 计费，**不需要** `imageInputPrice` 字段。
2. **图片生成价格来源**：`GET /api/v1/models/{modelId}/endpoints` 返回 `image_output` 字段（USD/token），`/v1/models` 不包含此字段。
3. **无专用 API 端点**：OpenRouter 没有图片生成模型专属 API，需用 endpoints 接口逐模型获取。

---

## 数据库变更

### `modelPricings` 表新增两列

```typescript
// packages/database/src/schemas/subscription.ts
imageOutputPrice: numeric('image_output_price', { precision: 15, scale: 6 }).default('0').notNull(),
userImageOutputPrice: numeric('user_image_output_price', { precision: 15, scale: 6 }).default('0').notNull(),
```

- `imageOutputPrice`：成本价（credits/M image output tokens）= `image_output_per_token × 1_000_000 × 500_000`
- `userImageOutputPrice`：用户价 = `imageOutputPrice × multiplier`
- **不加** `imageInputPrice`（vision 输入 token 已计入 `userInputPrice`）

---

## 计费逻辑说明

### 场景矩阵

| 场景 | inputTokens | outputTextTokens | outputImageTokens | 计费方式 |
|------|------------|-----------------|-------------------|---------|
| 纯对话（含 vision）| > 0 | > 0 | 0 | 正常 token 计费，inputPrice + outputPrice |
| 图片生成（Gemini）| > 0 | >= 0 | > 0 | inputPrice + outputPrice(text) + **imageOutputPrice** |
| 图片生成（Replicate/DALL-E，无 usage）| 0 | 0 | 0 | **perRequestPrice** 降级兜底 |

### `calculateCost` 新签名

```typescript
calculateCost(
  model: string,
  provider: string,
  inputTokens: number,
  outputTextTokens: number,    // 文字输出 token（原 outputTokens）
  outputImageTokens: number = 0,  // 图片输出 token（新增）
  isUserConfig: boolean = false
)
```

计算公式：
```
imageOutputCost = outputImageTokens > 0 && userImageOutputPrice > 0
  ? (outputImageTokens / 1M) × userImageOutputPrice
  : 0

perCost = inputTokens === 0 && outputTextTokens === 0 && outputImageTokens === 0
  ? perRequestPrice   // 无 usage 数据时降级
  : 0

cost = (inputTokens / 1M) × userInputPrice
     + (outputTextTokens / 1M) × userOutputPrice
     + imageOutputCost
     + perCost
```

---

## 执行步骤

### 步骤 1：DB Schema（packages/database）
**文件**：`packages/database/src/schemas/subscription.ts`
- 新增 `imageOutputPrice`、`userImageOutputPrice` 两列

### 步骤 2：Admin Schema 镜像
**文件**：`admin-system/server/src/db/subscription-schema.ts`
- 同步新增两列（admin 系统独立维护一份 schema 副本）

### 步骤 3：DB Migration
```bash
cd packages/database && bunx drizzle-kit generate
bunx drizzle-kit migrate
```

### 步骤 4：移除 pricing.image 误用
**文件**：`admin-system/server/src/utils/model-sync-adapters.ts`
- 删除 `pricing.image` → `extraPricing.imagePrice` 的提取
- 该字段是 vision 输入单价，不应影响图片生成计费

### 步骤 5：pricing-service.ts 重构
**文件**：`admin-system/server/src/services/pricing-service.ts`

**A. `syncProtoChatPricing` 清理**
- 删除 `imagePricePerUnit / approximatePricePerImage` 整个 imageOutput 块
- `perRequestPrice` 始终设为 `'0'`（新方案不再使用按次收费）
- `isImageModel` 判断仅用于 memo 前缀（`[auto-image]`），方便区分类型

**B. 新增 `syncImageOutputPricing()` 方法**
```
1. 查询所有 capabilities.imageOutput = true 的 enabled ProtoChat 模型
2. 提取 cleanModelId（去掉 "protochat::{alias}::" 前缀）
3. 调用 GET https://openrouter.ai/api/v1/models/{cleanModelId}/endpoints
4. 取所有 endpoint 中 image_output 字段的最小值
5. costImageOutputPrice = parseFloat(image_output) × 1_000_000 × SYNC_MULTIPLIER
6. userImageOutputPrice = costImageOutputPrice × multiplier
7. UPDATE modelPricings SET imageOutputPrice, userImageOutputPrice WHERE model = ...
8. 统计成功/失败数量，返回结果
```

**C. `updateAllUserPrices()` 补充**
- 遍历时同步更新 `userImageOutputPrice = imageOutputPrice × newMultiplier`

### 步骤 6：新增 API 路由
**文件**：`admin-system/server/src/routes/pricing.ts`
```
POST /api/admin/models/pricing/sync-image-output
→ pricingService.syncImageOutputPricing()
→ 返回 { success, updated: N, failed: [{ model, error }] }
```

### 步骤 7：calculateCost 更新
**文件**：`src/server/services/credit/index.ts`
- 更新签名，加 `outputImageTokens` 参数（默认 0，向后兼容）
- 实现新计费公式

### 步骤 8：chargeAfterGenerate 更新
**文件**：`src/business/server/image-generation/chargeAfterGenerate.ts`
```typescript
const inputTokens       = modelUsage?.totalInputTokens  ?? 0;
const outputTextTokens  = modelUsage?.outputTextTokens  ?? 0;   // 拆分
const outputImageTokens = modelUsage?.outputImageTokens ?? 0;   // 拆分
await creditService.calculateCost(modelId, provider, inputTokens, outputTextTokens, outputImageTokens);
```
- metadata 中增加 `outputImageTokens` 字段供统计使用

### 步骤 9：Admin 分析页去掉"按次"标签
**文件**：`admin-system/src/pages/Analytics/CostAnalysis/index.tsx`
- 删除"图片生成成本 (USD)"旁边的 `<Tag color="gold">按次</Tag>`
- 标题改为"图片生成成本 (USD)"（保留括号说明单位即可）

**文件**：`admin-system/server/src/routes/analytics.ts`
- 图片生成成本计算逻辑不变（依然从 `user_transactions type='image'` 汇总）
- 后端注释中"按次"字样也一并清理

### 步骤 10：前端同步按钮
**文件**：`admin-system/src/pages/Subscription/ModelPricing/index.tsx`
- 在图片生成模型 Tab 操作区新增"同步图片生成价格"按钮
- 调用 `POST /api/admin/models/pricing/sync-image-output`
- 显示 loading 状态 + 完成提示（更新 N 个模型，失败 M 个）
- 与已有"同步"按钮并排，功能独立

---

## 注意事项

1. **向后兼容**：`calculateCost` 新参数 `outputImageTokens` 默认值为 0，所有现有调用方（chat 管道等）无需修改。
2. **降级兜底**：`perRequestPrice` 保留，当 `outputImageTokens === 0 && userImageOutputPrice === 0` 时自动降级，确保 Replicate/ComfyUI 等无 token usage 的供应商不受影响。
3. **模型同步顺序**：需先执行常规 `/sync`（建立模型条目），再执行 `/sync-image-output`（填充 imageOutputPrice）。
4. **chat 管道图片输出**：若 Gemini 模型在对话中直接输出图片（非通过 `/async/image` 路由），chat 管道的 `handleCreditDeduction` 目前只传 `totalInputTokens/totalOutputTokens`，不拆分 outputImageTokens。本次不改 chat 管道（用户确认图片生成主要走 `/async/image` 路由）。
