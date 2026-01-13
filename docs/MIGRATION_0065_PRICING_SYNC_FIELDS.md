# 数据库迁移：添加定价同步配置字段

## 迁移编号
`0065_add_pricing_sync_fields_to_ai_providers`

## 目的
为 `ai_providers` 表添加在线同步配置字段，支持从供应商 API 动态同步模型列表和定价。

## 新增字段

### 1. pricing_sync_strategy
- **类型**: `varchar(50)`
- **说明**: 定价同步策略
- **可选值**:
  - `'api'`: 从供应商 API 同步（如 OpenRouter、DeepSeek 等）
  - `'model_bank'`: 从 Model-Bank 同步（静态数据）
  - `'manual'`: 手动配置
- **默认值**: `NULL`

### 2. pricing_api_url
- **类型**: `varchar(500)`
- **说明**: 定价 API 地址
- **示例**:
  - OpenRouter: `https://openrouter.ai/api/v1/models`
  - DeepSeek: `https://api.deepseek.com/v1/models` (示例)
- **默认值**: `NULL`

## 执行迁移

### 方式 1: 使用 psql 命令行（推荐）

```bash
# 连接到数据库并执行迁移
psql -U your_username -d your_database -f packages/database/migrations/0065_add_pricing_sync_fields_to_ai_providers.sql
```

### 方式 2: 使用 Node.js 脚本

```bash
# 在项目根目录执行
node scripts/run-migration.js 0065
```

### 方式 3: 手动执行（数据库客户端）

打开数据库客户端（如 pgAdmin、DBeaver、TablePlus 等），连接到数据库后执行以下 SQL：

```sql
-- 添加定价同步策略字段
ALTER TABLE "ai_providers"
ADD COLUMN IF NOT EXISTS "pricing_sync_strategy" varchar(50);

-- 添加定价API地址字段
ALTER TABLE "ai_providers"
ADD COLUMN IF NOT EXISTS "pricing_api_url" varchar(500);

-- 添加索引
CREATE INDEX IF NOT EXISTS "ai_providers_pricing_sync_strategy_idx"
ON "ai_providers" ("pricing_sync_strategy");

-- 更新现有 ProtoChat 供应商的配置（如果存在）
UPDATE "ai_providers"
SET
  "pricing_sync_strategy" = 'model_bank',
  "pricing_api_url" = NULL
WHERE "id" = 'protochat'
  AND "is_global" = true;
```

## 验证迁移

执行以下 SQL 验证字段是否成功添加：

```sql
-- 查看表结构
\d ai_providers

-- 或使用标准 SQL
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'ai_providers'
  AND column_name IN ('pricing_sync_strategy', 'pricing_api_url');
```

预期输出：
```
      column_name       |     data_type      | character_maximum_length
------------------------+--------------------+-------------------------
 pricing_sync_strategy  | character varying  |                      50
 pricing_api_url        | character varying  |                     500
```

## 配置示例

### OpenRouter 配置

**在子供应商详情页设置**:
```json
{
  "id": "openrouter",
  "name": "OpenRouter",
  "pricingSyncStrategy": "api",
  "pricingApiUrl": "https://openrouter.ai/api/v1/models"
}
```

### DeepSeek 配置（保留 model-bank）

```json
{
  "id": "deepseek",
  "name": "DeepSeek",
  "pricingSyncStrategy": "model_bank",
  "pricingApiUrl": null
}
```

## 功能说明

迁移完成后，系统将支持以下同步策略：

### 1. API 同步（推荐）
- **优点**: 实时数据，永不过时
- **适用**: OpenRouter、DeepSeek（如有 API）等支持 API 查询的供应商
- **配置**:
  1. 设置 `pricingSyncStrategy = 'api'`
  2. 填写 `pricingApiUrl`
  3. 点击"同步模型列表"按钮

### 2. Model-Bank 同步（后备）
- **优点**: 无需 API Key，离线可用
- **适用**: 没有公开 API 的供应商
- **配置**:
  1. 设置 `pricingSyncStrategy = 'model_bank'`
  2. `pricingApiUrl` 留空
  3. 点击"同步模型列表"按钮

### 3. 手动配置
- **优点**: 完全控制
- **适用**: 测试、自定义供应商
- **配置**:
  1. 设置 `pricingSyncStrategy = 'manual'`
  2. 手动创建模型和定价记录

## 降级策略

如果 API 同步失败，系统会自动降级到 model-bank：

```typescript
if (pricingApiUrl) {
  try {
    return await syncFromAPI(pricingApiUrl);
  } catch (error) {
    // 降级到 model-bank
    return await syncFromModelBank();
  }
}
```

## 回滚

如需回滚此迁移：

```sql
-- 删除字段
ALTER TABLE "ai_providers" DROP COLUMN IF EXISTS "pricing_sync_strategy";
ALTER TABLE "ai_providers" DROP COLUMN IF EXISTS "pricing_api_url";

-- 删除索引
DROP INDEX IF EXISTS "ai_providers_pricing_sync_strategy_idx";
```

## 注意事项

1. ⚠️ **执行前备份**: 建议先备份数据库
   ```bash
   pg_dump -U your_username -d your_database > backup_before_0065.sql
   ```

2. 🔒 **权限要求**: 需要 `ALTER TABLE` 和 `CREATE INDEX` 权限

3. 📊 **性能影响**:
   - 迁移在空表上执行时间 < 1秒
   - 在有数据的表上可能需要几秒钟
   - 不会锁定整个表（使用 `IF NOT EXISTS`）

4. 🔄 **兼容性**:
   - 支持 PostgreSQL 12+
   - 使用 `IF NOT EXISTS` 确保幂等性（可重复执行）

## 相关文件

- **迁移 SQL**: `packages/database/migrations/0065_add_pricing_sync_fields_to_ai_providers.sql`
- **Schema 定义**:
  - `packages/database/src/schemas/aiInfra.ts`
  - `admin-system/server/src/db/ai-providers-schema.ts`
- **同步逻辑**: `admin-system/server/src/routes/protochat.ts`
- **分析文档**: `docs/OPENROUTER_SYNC_ANALYSIS.md`
