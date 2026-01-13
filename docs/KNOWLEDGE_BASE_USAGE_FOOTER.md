# 知识库用量显示功能

## 概述

在知识库侧边栏底部添加了用量显示组件，显示文件存储和向量存储的使用情况，与 LobeChat 商业版界面一致。

## 实现的文件

### 1. UsageFooter 组件（共享组件）

**文件路径**: `src/app/[variants]/(main)/knowledge/components/UsageFooter/index.tsx`

**功能**:
- 显示文件用量（字节转换为 KB/MB/GB）
- 显示向量存储用量（条数）
- 使用进度条可视化使用率
- 实时从 API 获取数据

**设计细节**:
- 使用 `useClientDataSWR` hook 获取账户统计数据
- 调用 `usageService.getAccountStatistics()` API
- 使用 `margin-block-start: auto` 自动推到侧边栏底部
- 使用渐变色进度条（蓝绿渐变、绿色渐变）

### 2. 知识库详情页 Menu 组件更新

**文件路径**: `src/app/[variants]/(main)/knowledge/routes/KnowledgeBaseDetail/menu/Menu.tsx`

**修改**:
- 导入共享的 `UsageFooter` 组件
- 在 `CategoryMenu` 下方添加 `<UsageFooter />`

### 3. 知识库首页更新

**文件路径**: `src/app/[variants]/(main)/knowledge/routes/KnowledgeHome/index.tsx`

**修改**:
- 导入共享的 `UsageFooter` 组件
- 在 `Sidebar` 组件的 `Collection` 后面添加 `<UsageFooter />`

**说明**: 知识库首页和知识库详情页都使用同一个 `UsageFooter` 组件，确保用量显示一致。

## 数据来源

### API 端点

**tRPC 路由**: `src/server/routers/lambda/usage.ts`
- **方法**: `getAccountStatistics`
- **返回数据**:
  ```typescript
  {
    storage: {
      totalSizeMB: number;  // 已使用存储空间（MB）
      limitMB: number;      // 存储空间限制（MB）
    },
    vectors: {
      count: number;        // 已使用向量数量
      limit: number;        // 向量数量限制
    },
    balance: { ... },       // 积分相关
    resetCountdown: { ... } // 重置时间
  }
  ```

**服务**: `src/server/services/user/usageService.ts`
- **方法**: `getAccountStatistics()`
- **数据来源**:
  - 存储: 从 `files` 表统计 `size` 字段总和
  - 向量: 从 `embeddings` 表统计记录数
  - 限制: 从 `subscriptionPlans` 表读取用户套餐限制

### 客户端服务

**文件**: `src/services/usage.ts`
- 封装了 tRPC 调用
- 使用 SWR 进行数据缓存和自动刷新

## UI 设计

### 布局

```
┌─────────────────────────┐
│ 返回                    │
│                         │
│ 📘 测试                 │
│                         │
│ 📄 文档                 │
│                         │
│         ...             │
│                         │
│─────────────────────────│  ← border-top
│ 文件用量                 │
│ 38.8 KB / 10.0 MB       │
│ [████░░░░░░] 0.4%       │  ← 蓝绿渐变进度条
│                         │
│ 向量存储                 │
│ 1 / 100                 │
│ [█░░░░░░░░░] 1%         │  ← 绿色渐变进度条
└─────────────────────────┘
```

### 样式

- **容器**:
  - 顶部边框: `1px solid colorBorderSecondary`
  - 内边距: `12px 4px`
  - 自动推到底部: `margin-block-start: auto`

- **标签文字**:
  - 字号: `12px`
  - 颜色: `colorTextDescription` (次要文字颜色)

- **数值文字**:
  - 字号: `12px`
  - 字重: `500`
  - 颜色: `colorText` (主要文字颜色)
  - 等宽数字: `font-variant-numeric: tabular-nums`

- **进度条**:
  - 高度: `4px`
  - 宽度: `100%`
  - 隐藏百分比文字
  - 文件用量: 蓝色到青色渐变 (`#1890ff` → `#36cfc9`)
  - 向量存储: 绿色渐变 (`#52c41a` → `#73d13d`)

## 工具函数

### formatBytes

**功能**: 将字节数转换为人类可读格式

**实现**:
```typescript
const formatBytes = (bytes: number, decimals = 1): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};
```

**示例**:
- `formatBytes(0)` → `"0 B"`
- `formatBytes(1024)` → `"1.0 KB"`
- `formatBytes(39731)` → `"38.8 KB"`
- `formatBytes(10485760)` → `"10.0 MB"`

## 测试

### 功能测试

1. **显示正确的数据**:
   - 上传文件后，文件用量应该增加
   - 生成 embedding 后，向量存储数量应该增加
   - 刷新页面后数据应该保持

2. **进度条显示**:
   - 使用率 < 80%: 正常颜色显示
   - 使用率 >= 80%: 接近限制，进度条应该显示较深颜色
   - 使用率 = 100%: 达到限制

3. **响应式**:
   - 组件应该自动适应侧边栏宽度
   - 拖动调整侧边栏宽度时，组件应该正常显示

### 数据验证

**查询当前用量**:
```sql
-- 文件存储用量
SELECT SUM(size) as total_bytes FROM files WHERE user_id = 'user_xxx';

-- 向量存储数量
SELECT COUNT(*) as total_vectors FROM embeddings WHERE user_id = 'user_xxx';

-- 用户套餐限制
SELECT
  sp.storage_limit as storage_limit_mb,
  sp.vector_limit
FROM user_extensions ue
JOIN subscription_plans sp ON ue.plan_id = sp.id
WHERE ue.user_id = 'user_xxx';
```

## 国际化（可选）

如果需要支持多语言，可以在 `src/locales/default/knowledgeBase.ts` 添加翻译：

```typescript
// 中文
const knowledgeBase = {
  usage: {
    fileStorage: '文件用量',
    vectorStorage: '向量存储',
  },
};

// 英文 (locales/en-US/knowledgeBase.json)
{
  "usage": {
    "fileStorage": "File Storage",
    "vectorStorage": "Vector Storage"
  }
}
```

然后在 `UsageFooter.tsx` 中使用：
```typescript
const { t } = useTranslation('knowledgeBase');
// ...
<div className={styles.label}>{t('usage.fileStorage')}</div>
<div className={styles.label}>{t('usage.vectorStorage')}</div>
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/app/[variants]/(main)/knowledge/components/UsageFooter/index.tsx` | 用量显示组件（共享）|
| `src/app/[variants]/(main)/knowledge/routes/KnowledgeBaseDetail/menu/Menu.tsx` | 知识库详情页菜单（已更新）|
| `src/app/[variants]/(main)/knowledge/routes/KnowledgeHome/index.tsx` | 知识库首页（已更新）|
| `src/server/routers/lambda/usage.ts` | 用量统计 API |
| `src/server/services/user/usageService.ts` | 用量统计服务 |
| `src/services/usage.ts` | 客户端用量服务 |
| `src/features/User/UserPanel/CreditUsage.tsx` | 参考组件 |

## 效果预览

功能完成后，在以下两个位置的左侧侧边栏底部都会看到用量显示：

### 1. 知识库首页
- 位置：知识库列表页面左侧侧边栏底部
- 显示在"知识库集合"列表下方

### 2. 知识库详情页
- 位置：单个知识库详情页左侧侧边栏底部
- 显示在"文档"菜单下方

### 显示内容
- 文件用量条目，显示当前使用量和限制
- 向量存储条目，显示当前数量和限制
- 两个进度条可视化使用率
- 自动刷新数据（SWR 缓存）

与 LobeChat 商业版的显示效果完全一致。
