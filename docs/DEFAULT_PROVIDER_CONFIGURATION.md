# 默认AI供应商配置方案

## 问题描述

主项目新用户默认看到多个AI服务商（OpenAI、ComfyUI、Ollama等），需要配置为仅显示ProtoChat。

## 根本原因

系统有三个来源决定供应商是否启用：
1. **数据库** (`ai_providers` 表中 `is_global=true` 且 `enabled=true`)
2. **代码配置** (如 `ollama: { enabled: true }` 在桌面版)
3. **环境变量** (如 `ENABLED_OPENAI=1`)

原逻辑为 `enabled = 数据库 OR 代码配置 OR 环境变量`，导致即使数据库禁用，供应商仍可能被启用。

## 解决方案

### 1. 数据库修改 (必需)

执行SQL脚本添加所有供应商到数据库，仅ProtoChat启用：

```bash
# 执行SQL脚本
psql $DATABASE_URL -f scripts/disable-all-global-providers.sql
```

或手动执行SQL:
- 见 `scripts/disable-all-global-providers.sql`
- 添加66个供应商，全部 `enabled=false, is_global=true`
- ProtoChat已存在，保持 `enabled=true`

### 2. 代码修改 (必需)

#### 修改 1: 移除Ollama的硬编码启用状态
**文件**: `src/server/globalConfig/index.ts`

```typescript
// ❌ 修改前
ollama: {
  enabled: isDesktop ? true : undefined,
  fetchOnClient: isDesktop ? false : !process.env.OLLAMA_PROXY_URL,
},

// ✅ 修改后
ollama: {
  fetchOnClient: isDesktop ? false : !process.env.OLLAMA_PROXY_URL,
},
```

#### 修改 2: 数据库优先策略
**文件**: `src/server/globalConfig/genServerAiProviderConfig.ts`

```typescript
// ❌ 修改前：数据库 OR 配置 OR 环境变量
enabled:
  isGlobalEnabled ||
  (typeof providerConfig.enabled !== 'undefined'
    ? providerConfig.enabled
    : llmConfig[providerConfig.enabledKey || `ENABLED_${providerUpperCase}`]),

// ✅ 修改后：数据库优先，不存在才用配置/环境变量
enabled: dbProvider
  ? isGlobalEnabled  // 在数据库中：仅使用数据库值
  : (typeof providerConfig.enabled !== 'undefined'
    ? providerConfig.enabled
    : llmConfig[providerConfig.enabledKey || `ENABLED_${providerUpperCase}`]),
```

### 3. 环境变量检查 (可选)

确保`.env`文件中没有启用其他供应商的环境变量：

```bash
# 检查是否有这些变量
grep -E "ENABLED_(OPENAI|COMFYUI|OLLAMA|AZURE)" .env
```

如有，注释掉或删除它们。

## 实施步骤

1. ✅ 执行SQL脚本添加所有供应商
2. ✅ 修改 `src/server/globalConfig/index.ts` 移除Ollama硬编码
3. ✅ 修改 `src/server/globalConfig/genServerAiProviderConfig.ts` 实现数据库优先
4. 检查并清理环境变量
5. 重启服务器
6. 创建新用户测试，确认仅看到ProtoChat

## 验证

### 检查数据库状态

```bash
node scripts/check-global-providers.js
```

应该看到：
- 只有ProtoChat的 `enabled=true`
- 其他所有供应商 `enabled=false`

### 检查新用户体验

1. 创建新用户账号
2. 访问AI服务商列表
3. 确认只显示ProtoChat供应商

## 架构改进

修改后的架构：
```
1. 检查供应商是否在数据库中 (ai_providers, is_global=true)
   ├─ 是：使用数据库的 enabled 值（忽略代码配置和环境变量）
   └─ 否：检查代码配置 → 检查环境变量 → 默认禁用
```

这确保了：
- 数据库是全局供应商的**单一数据源**
- 管理员可以完全通过后台管理系统控制供应商启用状态
- 不会被代码或环境变量意外覆盖

## 后续维护

以后添加新供应商时：
1. 在数据库中添加记录，设置 `is_global=true` 和 `enabled=false/true`
2. 不要在代码中硬编码 `enabled: true`
3. 不要在`.env`中设置 `ENABLED_XXX=1` (除非用于开发测试)
