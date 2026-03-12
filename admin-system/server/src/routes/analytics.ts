import express from 'express';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { getUSDCNYRate, refreshExchangeRate } from '../services/exchange-rate-service';

const router: express.Router = express.Router();

router.use(authenticateToken);

// 辅助函数：根据 period 计算时间范围
const getDateRange = (dateParam: string | undefined, period: 'month' | 'year') => {
  const date = dateParam ? new Date(dateParam) : new Date();
  let startDate: Date;
  let endDate: Date;
  let dateFormat: string;

  if (period === 'year') {
    startDate = new Date(date.getFullYear(), 0, 1);
    endDate = new Date(date.getFullYear() + 1, 0, 1);
    dateFormat = 'YYYY-MM'; // 年度统计按月聚合
  } else {
    startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    dateFormat = 'YYYY-MM-DD'; // 月度统计按天聚合
  }

  return {
    startStr: startDate.toISOString(),
    endStr: endDate.toISOString(),
    dateFormat,
  };
};

// 辅助函数：构建 ProtoChat 价格映射表
const buildProtochatPriceMap = async (): Promise<Map<string, { inputPrice: number; outputPrice: number }>> => {
  const protochatPricing = await db.execute(sql`
    SELECT
      p.model_id as "modelId",
      m.original_id as "originalId",
      p.cost_input_price as "costInputPrice",
      p.cost_output_price as "costOutputPrice"
    FROM protochat_model_pricing p
    LEFT JOIN protochat_models m ON p.model_id = m.id
  `);

  const priceMap = new Map<string, { inputPrice: number; outputPrice: number }>();
  for (const p of (protochatPricing as any[])) {
    const price = {
      inputPrice: parseFloat(p.costInputPrice || '0'),
      outputPrice: parseFloat(p.costOutputPrice || '0'),
    };
    priceMap.set(p.modelId, price);
    if (p.originalId) {
      const colonIdx = (p.originalId as string).indexOf('::');
      if (colonIdx !== -1) {
        const rawModelName = (p.originalId as string).slice(colonIdx + 2);
        if (rawModelName) priceMap.set(rawModelName, price);
      }
    }
  }
  return priceMap;
};

// 辅助函数：从 protochat_providers 加载 alias → name 映射
const buildAliasNameMap = async (): Promise<Map<string, string>> => {
  const rows = await db.execute(sql`
    SELECT alias, name FROM protochat_providers WHERE alias IS NOT NULL
  `);
  const map = new Map<string, string>();
  for (const r of (rows as any[])) {
    if (r.alias) map.set(r.alias, r.name);
  }
  return map;
};

// 从模型ID中提取子供应商 alias，例如 'protochat::a1::gpt-4o' → 'a1'
const extractSubProviderAlias = (model: string): string | null => {
  const m = model?.match(/^protochat::([^:]+)::/);
  return m ? m[1] : null;
};

// 辅助函数：根据模型名获取价格
// - protochat 供应商：按模型名查找（支持 protochat:: 前缀和裸模型名）
// - 其他供应商（如 openrouter）：按原始模型名查找（buildProtochatPriceMap 已写入）
const getProtochatModelPrice = (
  model: string,
  provider: string | null,
  priceMap: Map<string, { inputPrice: number; outputPrice: number }>
): { inputPrice: number; outputPrice: number } => {
  const ZERO = { inputPrice: 0, outputPrice: 0 };
  if (!model) return ZERO;

  // 1. 去掉 protochat:: 前缀后直接查
  if (model.startsWith('protochat::')) {
    const modelId = model.replace('protochat::', '');
    if (priceMap.has(modelId)) return priceMap.get(modelId)!;
  }

  // 2. 直接用模型名查（覆盖：裸 ProtoChat ID、original_id 中提取的原始名）
  if (priceMap.has(model)) return priceMap.get(model)!;

  return ZERO;
};

// GET /api/admin/analytics/cost - 成本分析
router.get('/cost', requirePermission('stats.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { month, period = 'month' } = req.query;
    const { startStr, endStr, dateFormat } = getDateRange(month as string | undefined, period as 'month' | 'year');

    // 1. 获取 Chat 统计（按模型分组）
    // 只统计 protochat 供应商的成本（其他供应商不计入成本）
    const chatStats = await db.execute(sql`
      SELECT
        m.model,
        m.provider,
        SUM((COALESCE(m.metadata ->> 'totalInputTokens', '0'))::int) as "inputTokens",
        SUM((COALESCE(m.metadata ->> 'totalOutputTokens', '0'))::int) as "outputTokens",
        COUNT(*) as "requestCount"
      FROM messages m
      WHERE m.role = 'assistant'
        AND m.created_at >= ${startStr}
        AND m.created_at < ${endStr}
        AND m.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
      GROUP BY m.model, m.provider
    `);

    // 2. 获取 ProtoChat 模型的美元价格 + alias→name 映射
    const [priceMap, aliasNameMap] = await Promise.all([buildProtochatPriceMap(), buildAliasNameMap()]);

    // 3. 获取 Embedding 统计
    const embeddingStats = await db.execute(sql`
      SELECT
        COALESCE(SUM(input_tokens), 0) as "totalTokens",
        COALESCE(SUM(cost_price::numeric), 0) as "totalCost"
      FROM embedding_usage_logs
      WHERE created_at >= ${startStr}
        AND created_at < ${endStr}
    `);

    // 4. 获取图片生成统计（从 user_transactions 查询）
    const imageStats = await db.execute(sql`
      SELECT
        (metadata ->> 'model') as model,
        (metadata ->> 'provider') as provider,
        COUNT(*) as "requestCount",
        ABS(SUM(amount::numeric)) as "totalCost",
        COALESCE(SUM((NULLIF(metadata ->> 'totalInputTokens', ''))::bigint), 0) as "totalInputTokens",
        COALESCE(SUM((NULLIF(metadata ->> 'totalOutputTokens', ''))::bigint), 0) as "totalOutputTokens",
        COALESCE(SUM((NULLIF(metadata ->> 'outputImageTokens', ''))::bigint), 0) as "outputImageTokens"
      FROM user_transactions
      WHERE type = 'CONSUMPTION'
        AND created_at >= ${startStr}
        AND created_at < ${endStr}
        AND metadata ->> 'type' = 'image'
      GROUP BY metadata ->> 'model', metadata ->> 'provider'
    `);

    // 4b. 获取标题生成统计（从 user_transactions 查询，type='title_generation'）
    const titleGenStats = await db.execute(sql`
      SELECT
        (metadata ->> 'model') as model,
        (metadata ->> 'provider') as provider,
        COUNT(*) as "requestCount",
        COALESCE(SUM((NULLIF(metadata ->> 'totalInputTokens', ''))::bigint), 0) as "totalInputTokens",
        COALESCE(SUM((NULLIF(metadata ->> 'totalOutputTokens', ''))::bigint), 0) as "totalOutputTokens"
      FROM user_transactions
      WHERE type = 'CONSUMPTION'
        AND created_at >= ${startStr}
        AND created_at < ${endStr}
        AND metadata ->> 'type' = 'title_generation'
      GROUP BY metadata ->> 'model', metadata ->> 'provider'
    `);

    // 5. 获取记忆统计
    const memoryJobStats = await db.execute(sql`
      SELECT
        COUNT(*) as "jobCount",
        COALESCE(SUM((metadata -> 'llmUsage' ->> 'inputTokens')::int), 0) as "llmInputTokens",
        COALESCE(SUM((metadata -> 'llmUsage' ->> 'outputTokens')::int), 0) as "llmOutputTokens",
        MAX(metadata -> 'llmUsage' ->> 'model') as "llmModel"
      FROM async_tasks
      WHERE type = 'user_memory_extraction:chat_topic'
        AND created_at >= ${startStr}
        AND created_at < ${endStr}
    `);

    const memoryRecordStats = await db.execute(sql`
      SELECT COUNT(*) as "recordCount"
      FROM user_memories
      WHERE created_at >= ${startStr}
        AND created_at < ${endStr}
    `);

    const memoryEmbeddingStats = await db.execute(sql`
      SELECT
        COALESCE(SUM(input_tokens), 0) as "totalTokens",
        COALESCE(SUM(cost_price::numeric), 0) as "totalCost"
      FROM embedding_usage_logs
      WHERE created_at >= ${startStr}
        AND created_at < ${endStr}
        AND operation_type IN ('memory_search', 'memory_extraction')
    `);

    // 5b. 获取免费用户成本统计（用于计算纯支出，只统计 protochat 供应商）
    const freeUserStats = await db.execute(sql`
      SELECT
        m.model,
        m.provider,
        SUM((COALESCE(m.metadata ->> 'totalInputTokens', '0'))::int) as "inputTokens",
        SUM((COALESCE(m.metadata ->> 'totalOutputTokens', '0'))::int) as "outputTokens",
        COUNT(*) as "requestCount"
      FROM messages m
      LEFT JOIN user_extensions ue ON m.user_id = ue.user_id
      WHERE m.role = 'assistant'
        AND m.created_at >= ${startStr}
        AND m.created_at < ${endStr}
        AND m.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
        AND (ue.current_plan IS NULL OR ue.current_plan IN ('free', 'plan_free'))
      GROUP BY m.model, m.provider
    `);

    // 6. 趋势数据（月度按天，年度按月）- 分别返回上行和下行 Token
    const dailyTrend = await db.execute(sql`
      SELECT
        TO_CHAR(m.created_at, ${sql.raw(`'${dateFormat}'`)}) as date,
        m.model,
        SUM((COALESCE(m.metadata ->> 'totalInputTokens', '0'))::int) as "inputTokens",
        SUM((COALESCE(m.metadata ->> 'totalOutputTokens', '0'))::int) as "outputTokens"
      FROM messages m
      WHERE m.role = 'assistant'
        AND m.created_at >= ${startStr}
        AND m.created_at < ${endStr}
        AND m.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
      GROUP BY TO_CHAR(m.created_at, ${sql.raw(`'${dateFormat}'`)}), m.model
      ORDER BY date ASC
    `);

    // 计算成本（只有 protochat 供应商计入成本）
    let totalChatInputTokens = 0;
    let totalChatOutputTokens = 0;
    let totalChatCost = 0;
    let totalRequestCount = 0;
    const modelStats: any[] = [];
    const subProviderMap = new Map<string, { alias: string; providerName: string; totalTokens: number; cost: number }>();

    for (const item of (chatStats as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.inputTokens || '0');
      const outputTokens = parseInt(item.outputTokens || '0');
      const requestCount = parseInt(item.requestCount || '0');

      const cost = (inputTokens / 1_000_000) * inputPrice +
        (outputTokens / 1_000_000) * outputPrice;

      totalChatInputTokens += inputTokens;
      totalChatOutputTokens += outputTokens;
      totalChatCost += cost;
      totalRequestCount += requestCount;

      modelStats.push({
        model: item.model,
        provider: item.provider,
        inputTokens,
        outputTokens,
        requestCount,
        cost: cost.toFixed(8),
      });

      // 子供应商统计：从模型ID提取 alias
      const alias = extractSubProviderAlias(item.model) || item.provider || 'unknown';
      const providerName = aliasNameMap.get(alias) || alias;
      if (!subProviderMap.has(alias)) {
        subProviderMap.set(alias, { alias, providerName, totalTokens: 0, cost: 0 });
      }
      const sp = subProviderMap.get(alias)!;
      sp.totalTokens += inputTokens + outputTokens;
      sp.cost += cost;
    }

    // 免费用户成本计算（只有 protochat 供应商计入成本）
    let freeUserCost = 0;
    const freeUserModelStats: any[] = [];
    for (const item of (freeUserStats as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.inputTokens || '0');
      const outputTokens = parseInt(item.outputTokens || '0');
      const requestCount = parseInt(item.requestCount || '0');

      const cost = (inputTokens / 1_000_000) * inputPrice +
        (outputTokens / 1_000_000) * outputPrice;

      freeUserCost += cost;
      freeUserModelStats.push({
        model: item.model,
        provider: item.provider,
        inputTokens,
        outputTokens,
        requestCount,
        cost: cost.toFixed(8),
      });
    }

    const embeddingTokens = parseInt((embeddingStats[0] as any)?.totalTokens || '0');
    const embeddingCost = parseFloat((embeddingStats[0] as any)?.totalCost || '0');
    const memoryJobCount = parseInt((memoryJobStats[0] as any)?.jobCount || '0');
    const memoryRecordCount = parseInt((memoryRecordStats[0] as any)?.recordCount || '0');
    const memoryEmbeddingTokens = parseInt((memoryEmbeddingStats[0] as any)?.totalTokens || '0');
    const memoryEmbeddingCost = parseFloat((memoryEmbeddingStats[0] as any)?.totalCost || '0');

    // LLM cost for memory extraction (from async_tasks.metadata.llmUsage)
    const memoryLlmInputTokens = parseInt((memoryJobStats[0] as any)?.llmInputTokens || '0');
    const memoryLlmOutputTokens = parseInt((memoryJobStats[0] as any)?.llmOutputTokens || '0');
    const memoryLlmModel = (memoryJobStats[0] as any)?.llmModel || '';
    const memoryLlmPrice = getProtochatModelPrice(memoryLlmModel, null, priceMap);
    const memoryLlmCost =
      (memoryLlmInputTokens / 1_000_000) * memoryLlmPrice.inputPrice +
      (memoryLlmOutputTokens / 1_000_000) * memoryLlmPrice.outputPrice;
    const memoryCostTotal = memoryEmbeddingCost + memoryLlmCost;

    // 统计图片生成成本（积分，需转换为美元）
    // 1 USD = 500,000 积分（与 SYNC_MULTIPLIER 一致）
    let totalImageCost = 0;
    let totalImageRequests = 0;
    let totalImageInputTokens = 0;
    let totalImageOutputTokens = 0;
    let totalImageOutputImageTokens = 0;
    const imageModelStats: any[] = [];

    for (const item of (imageStats as any[])) {
      const requestCount = parseInt(item.requestCount || '0');
      const costInCredits = parseFloat(item.totalCost || '0');
      const costInUSD = costInCredits / 500000;
      const inputTokens = parseInt(item.totalInputTokens || '0');
      const outputTokens = parseInt(item.totalOutputTokens || '0');
      const outputImageTokens = parseInt(item.outputImageTokens || '0');

      totalImageCost += costInUSD;
      totalImageRequests += requestCount;
      totalImageInputTokens += inputTokens;
      totalImageOutputTokens += outputTokens;
      totalImageOutputImageTokens += outputImageTokens;

      imageModelStats.push({
        model: item.model || 'unknown',
        provider: item.provider || 'unknown',
        requestCount,
        inputTokens,
        outputTokens,
        outputImageTokens,
        cost: costInUSD.toFixed(8),
      });

      // 图片生成也归入子供应商统计
      const imgAlias = extractSubProviderAlias(item.model || '') || item.provider || 'unknown';
      const imgProviderName = aliasNameMap.get(imgAlias) || imgAlias;
      if (!subProviderMap.has(imgAlias)) {
        subProviderMap.set(imgAlias, { alias: imgAlias, providerName: imgProviderName, totalTokens: 0, cost: 0 });
      }
      subProviderMap.get(imgAlias)!.cost += costInUSD;
    }

    // 合并图片模型到总模型统计
    modelStats.push(...imageModelStats);

    // 标题生成成本
    let totalTitleCost = 0;
    let totalTitleRequests = 0;
    let totalTitleInputTokens = 0;
    let totalTitleOutputTokens = 0;

    for (const item of (titleGenStats as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.totalInputTokens || '0');
      const outputTokens = parseInt(item.totalOutputTokens || '0');
      const requestCount = parseInt(item.requestCount || '0');
      const cost = (inputTokens / 1_000_000) * inputPrice +
        (outputTokens / 1_000_000) * outputPrice;

      totalTitleCost += cost;
      totalTitleRequests += requestCount;
      totalTitleInputTokens += inputTokens;
      totalTitleOutputTokens += outputTokens;

      // 合并到模型统计（title gen 通常用同一个模型，若已存在则累加）
      const existing = modelStats.find(m => m.model === item.model && m.provider === item.provider);
      if (existing) {
        existing.inputTokens += inputTokens;
        existing.outputTokens += outputTokens;
        existing.requestCount += requestCount;
        existing.cost = (parseFloat(existing.cost) + cost).toFixed(8);
      } else {
        modelStats.push({
          model: item.model || 'unknown',
          provider: item.provider || 'unknown',
          inputTokens,
          outputTokens,
          requestCount,
          cost: cost.toFixed(8),
        });
      }

      // 标题生成也归入子供应商
      const titleAlias = extractSubProviderAlias(item.model || '') || item.provider || 'unknown';
      const titleProviderName = aliasNameMap.get(titleAlias) || titleAlias;
      if (!subProviderMap.has(titleAlias)) {
        subProviderMap.set(titleAlias, { alias: titleAlias, providerName: titleProviderName, totalTokens: 0, cost: 0 });
      }
      const tsp = subProviderMap.get(titleAlias)!;
      tsp.totalTokens += inputTokens + outputTokens;
      tsp.cost += cost;
    }

    return res.json({
      data: {
        overview: {
          chatInputTokens: totalChatInputTokens,
          chatOutputTokens: totalChatOutputTokens,
          chatCost: totalChatCost.toFixed(6),
          embeddingTokens,
          embeddingCost: embeddingCost.toFixed(6),
          imageRequests: totalImageRequests,
          imageCost: totalImageCost.toFixed(6),
          imageInputTokens: totalImageInputTokens,
          imageOutputTokens: totalImageOutputTokens,
          imageOutputImageTokens: totalImageOutputImageTokens,
          memoryJobCount,
          memoryRecordCount,
          memoryEmbeddingTokens,
          memoryCost: memoryCostTotal.toFixed(6),
          memoryLlmInputTokens,
          memoryLlmOutputTokens,
          memoryLlmCost: memoryLlmCost.toFixed(6),
          titleInputTokens: totalTitleInputTokens,
          titleOutputTokens: totalTitleOutputTokens,
          titleCost: totalTitleCost.toFixed(6),
          freeUserCost: freeUserCost.toFixed(6),
          requestCount: totalRequestCount + totalImageRequests,
          totalCost: (totalChatCost + embeddingCost + totalImageCost + memoryCostTotal + totalTitleCost).toFixed(6),
        },
        dailyTrend,
        modelStats: modelStats.sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost)),
        subProviderStats: Array.from(subProviderMap.values())
          .map(sp => ({ ...sp, cost: sp.cost.toFixed(6) }))
          .sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost)),
        freeUserStats: freeUserModelStats.sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost)),
        imageStats: imageModelStats.sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost)),
      },
      success: true,
    });
  } catch (error) {
    console.error('Analytics cost error:', error);
    return res.status(500).json({ message: 'Failed to fetch cost analytics', success: false });
  }
});

// GET /api/admin/analytics/revenue - 收支概览
router.get('/revenue', requirePermission('stats.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { month, period = 'month' } = req.query;
    const { startStr, endStr, dateFormat } = getDateRange(month as string | undefined, period as 'month' | 'year');

    // 获取 ProtoChat 价格映射
    const priceMap = await buildProtochatPriceMap();

    // 1. 订阅收入统计（人民币）
    const revenueStats = await db.execute(sql`
      SELECT
        sp.name as "planName",
        sp.slug,
        sp.monthly_price / 100.0 as "priceCNY",
        COUNT(ush.id) as "count"
      FROM user_subscription_history ush
      JOIN subscription_plans sp ON ush.plan_id = sp.id
      WHERE ush.started_at >= ${startStr}
        AND ush.started_at < ${endStr}
        AND sp.monthly_price > 0
      GROUP BY sp.name, sp.slug, sp.monthly_price
    `);

    // 2. 成本统计（只统计 protochat 供应商）
    const costStats = await db.execute(sql`
      SELECT
        m.model,
        m.provider,
        SUM((COALESCE(m.metadata ->> 'totalInputTokens', '0'))::int) as "inputTokens",
        SUM((COALESCE(m.metadata ->> 'totalOutputTokens', '0'))::int) as "outputTokens",
        COUNT(*) as "requestCount"
      FROM messages m
      WHERE m.role = 'assistant'
        AND m.created_at >= ${startStr}
        AND m.created_at < ${endStr}
        AND m.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
      GROUP BY m.model, m.provider
    `);

    // 3. Embedding 成本
    const embeddingCost = await db.execute(sql`
      SELECT COALESCE(SUM(cost_price::numeric), 0) as "totalCost"
      FROM embedding_usage_logs
      WHERE created_at >= ${startStr}
        AND created_at < ${endStr}
    `);

    // 4. 图片生成成本（从 user_transactions）
    const imageCost = await db.execute(sql`
      SELECT COALESCE(ABS(SUM(amount::numeric)), 0) as "totalCost"
      FROM user_transactions
      WHERE type = 'CONSUMPTION'
        AND created_at >= ${startStr}
        AND created_at < ${endStr}
        AND metadata ->> 'type' = 'image'
    `);

    // 4b. 标题生成成本（从 user_transactions）
    const revTitleGenStats = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, ${sql.raw(`'${dateFormat}'`)}) as date,
        (metadata ->> 'model') as model,
        (metadata ->> 'provider') as provider,
        COALESCE(SUM((NULLIF(metadata ->> 'totalInputTokens', ''))::bigint), 0) as "totalInputTokens",
        COALESCE(SUM((NULLIF(metadata ->> 'totalOutputTokens', ''))::bigint), 0) as "totalOutputTokens",
        COUNT(*) as "requestCount"
      FROM user_transactions
      WHERE type = 'CONSUMPTION'
        AND created_at >= ${startStr}
        AND created_at < ${endStr}
        AND metadata ->> 'type' = 'title_generation'
      GROUP BY TO_CHAR(created_at, ${sql.raw(`'${dateFormat}'`)}), metadata ->> 'model', metadata ->> 'provider'
    `);

    // 4c. 记忆相关 Embedding 成本（memory_search + memory_extraction）
    const memoryEmbeddingCostStats = await db.execute(sql`
      SELECT
        COALESCE(SUM(input_tokens), 0) as "totalTokens",
        COALESCE(SUM(cost_price::numeric), 0) as "totalCost"
      FROM embedding_usage_logs
      WHERE created_at >= ${startStr}
        AND created_at < ${endStr}
        AND operation_type IN ('memory_search', 'memory_extraction')
    `);

    // 4c. 记忆提取任务数、记忆条目数及 LLM 用量
    const revenueMemoryJobStats = await db.execute(sql`
      SELECT
        COUNT(*) as "jobCount",
        COALESCE(SUM((metadata -> 'llmUsage' ->> 'inputTokens')::int), 0) as "llmInputTokens",
        COALESCE(SUM((metadata -> 'llmUsage' ->> 'outputTokens')::int), 0) as "llmOutputTokens",
        MAX(metadata -> 'llmUsage' ->> 'model') as "llmModel"
      FROM async_tasks
      WHERE type = 'user_memory_extraction:chat_topic'
        AND created_at >= ${startStr}
        AND created_at < ${endStr}
    `);
    const memoryJobCount = parseInt((revenueMemoryJobStats[0] as any)?.jobCount || '0');

    const revenueMemoryRecordStats = await db.execute(sql`
      SELECT COUNT(*) as "recordCount"
      FROM user_memories
      WHERE created_at >= ${startStr}
        AND created_at < ${endStr}
    `);
    const memoryRecordCount = parseInt((revenueMemoryRecordStats[0] as any)?.recordCount || '0');

    // 5. 收支趋势（收入，月度按天/年度按月）
    const dailyRevenue = await db.execute(sql`
      SELECT
        TO_CHAR(ush.started_at, ${sql.raw(`'${dateFormat}'`)}) as date,
        COALESCE(SUM(sp.monthly_price::numeric / 100.0), 0) as "revenueCNY"
      FROM user_subscription_history ush
      JOIN subscription_plans sp ON ush.plan_id = sp.id
      WHERE ush.started_at >= ${startStr}
        AND ush.started_at < ${endStr}
        AND sp.monthly_price > 0
      GROUP BY TO_CHAR(ush.started_at, ${sql.raw(`'${dateFormat}'`)})
    `);

    // 5b. 成本趋势（按日期和模型分组，后续在JS中计算成本）
    const dailyCostRaw = await db.execute(sql`
      SELECT
        TO_CHAR(m.created_at, ${sql.raw(`'${dateFormat}'`)}) as date,
        m.model,
        m.provider,
        SUM((COALESCE(m.metadata ->> 'totalInputTokens', '0'))::int) as "inputTokens",
        SUM((COALESCE(m.metadata ->> 'totalOutputTokens', '0'))::int) as "outputTokens"
      FROM messages m
      WHERE m.role = 'assistant'
        AND m.created_at >= ${startStr}
        AND m.created_at < ${endStr}
        AND m.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
      GROUP BY TO_CHAR(m.created_at, ${sql.raw(`'${dateFormat}'`)}), m.model, m.provider
    `);

    // 6. 付费用户数
    const subscriberStats = await db.execute(sql`
      SELECT
        COUNT(DISTINCT ush.user_id) as "subscriberCount",
        COUNT(DISTINCT CASE WHEN ush.started_at >= ${startStr} THEN ush.user_id END) as "newSubscribers"
      FROM user_subscription_history ush
      JOIN subscription_plans sp ON ush.plan_id = sp.id
      WHERE sp.monthly_price > 0
        AND ush.is_active = true
    `);

    // 计算总收入（人民币）
    let totalRevenueCNY = 0;
    const subscriptionRevenue = (revenueStats as any[]).map((item) => {
      const revenueCNY = parseFloat(item.priceCNY || '0') * parseInt(item.count || '0');
      totalRevenueCNY += revenueCNY;
      return {
        planName: item.planName,
        slug: item.slug,
        count: parseInt(item.count || '0'),
        revenueCNY,
      };
    });

    // 计算总成本（美元，只统计 protochat 供应商）
    let totalChatCostUSD = 0;
    let totalRequestCount = 0;
    let totalChatInputTokens = 0;
    let totalChatOutputTokens = 0;

    for (const item of (costStats as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.inputTokens || '0');
      const outputTokens = parseInt(item.outputTokens || '0');
      const requestCount = parseInt(item.requestCount || '0');

      const cost = (inputTokens / 1_000_000) * inputPrice +
        (outputTokens / 1_000_000) * outputPrice;

      totalChatCostUSD += cost;
      totalRequestCount += requestCount;
      totalChatInputTokens += inputTokens;
      totalChatOutputTokens += outputTokens;
    }

    const embeddingCostUSD = parseFloat((embeddingCost[0] as any)?.totalCost || '0');
    const imageCostInCredits = parseFloat((imageCost[0] as any)?.totalCost || '0');
    const imageCostUSD = imageCostInCredits / 500000; // 转换为美元
    const memoryEmbeddingCostUSD = parseFloat((memoryEmbeddingCostStats[0] as any)?.totalCost || '0');
    const memoryEmbeddingTokens = parseInt((memoryEmbeddingCostStats[0] as any)?.totalTokens || '0');

    // LLM cost for memory extraction
    const revMemoryLlmInputTokens = parseInt((revenueMemoryJobStats[0] as any)?.llmInputTokens || '0');
    const revMemoryLlmOutputTokens = parseInt((revenueMemoryJobStats[0] as any)?.llmOutputTokens || '0');
    const revMemoryLlmModel = (revenueMemoryJobStats[0] as any)?.llmModel || '';
    const revMemoryLlmPrice = getProtochatModelPrice(revMemoryLlmModel, null, priceMap);
    const revMemoryLlmCostUSD =
      (revMemoryLlmInputTokens / 1_000_000) * revMemoryLlmPrice.inputPrice +
      (revMemoryLlmOutputTokens / 1_000_000) * revMemoryLlmPrice.outputPrice;
    const revMemoryCostUSD = memoryEmbeddingCostUSD + revMemoryLlmCostUSD;

    // 计算标题生成成本
    let titleGenCostUSD = 0;
    let titleGenRequestCount = 0;
    for (const item of (revTitleGenStats as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.totalInputTokens || '0');
      const outputTokens = parseInt(item.totalOutputTokens || '0');
      titleGenCostUSD += (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
      titleGenRequestCount += parseInt(item.requestCount || '0');
      // 加入每日成本趋势
      const date = item.date;
      const cost = (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
      dailyCostMap.set(date, (dailyCostMap.get(date) || 0) + cost);
    }

    const totalCostUSD = totalChatCostUSD + embeddingCostUSD + imageCostUSD + revMemoryCostUSD + titleGenCostUSD;

    // 获取 Embedding token 数
    const embeddingTokenStats = await db.execute(sql`
      SELECT COALESCE(SUM(input_tokens), 0) as "totalTokens"
      FROM embedding_usage_logs
      WHERE created_at >= ${startStr}
        AND created_at < ${endStr}
    `);
    const embeddingTokens = parseInt((embeddingTokenStats[0] as any)?.totalTokens || '0');

    // 构建成本明细
    const costBreakdown: any[] = [];
    costBreakdown.push({
      category: 'Chat 对话',
      inputTokens: totalChatInputTokens,
      outputTokens: totalChatOutputTokens,
      costUSD: totalChatCostUSD.toFixed(6),
      percentage: totalCostUSD > 0 ? ((totalChatCostUSD / totalCostUSD) * 100).toFixed(1) : '0',
    });

    const nonMemoryEmbeddingTokens = Math.max(0, embeddingTokens - memoryEmbeddingTokens);
    const nonMemoryEmbeddingCostUSD = Math.max(0, embeddingCostUSD - memoryEmbeddingCostUSD);

    costBreakdown.push({
      category: 'Embedding 向量化',
      inputTokens: nonMemoryEmbeddingTokens,
      outputTokens: 0,
      costUSD: nonMemoryEmbeddingCostUSD.toFixed(6),
      percentage: totalCostUSD > 0 ? ((nonMemoryEmbeddingCostUSD / totalCostUSD) * 100).toFixed(1) : '0',
    });

    // 图片生成成本（从 user_transactions 统计请求数）
    const imageRequestStats = await db.execute(sql`
      SELECT COUNT(*) as "requestCount"
      FROM user_transactions
      WHERE type = 'CONSUMPTION'
        AND created_at >= ${startStr}
        AND created_at < ${endStr}
        AND metadata ->> 'type' = 'image'
    `);
    const imageRequests = parseInt((imageRequestStats[0] as any)?.requestCount || '0');

    costBreakdown.push({
      category: '图片生成',
      inputTokens: 0,
      outputTokens: 0,
      requestCount: imageRequests,
      costUSD: imageCostUSD.toFixed(6),
      percentage: totalCostUSD > 0 ? ((imageCostUSD / totalCostUSD) * 100).toFixed(1) : '0',
    });

    costBreakdown.push({
      category: '记忆提取',
      inputTokens: memoryEmbeddingTokens + revMemoryLlmInputTokens,
      outputTokens: revMemoryLlmOutputTokens,
      jobCount: memoryJobCount,
      recordCount: memoryRecordCount,
      costUSD: revMemoryCostUSD.toFixed(6),
      percentage: totalCostUSD > 0 ? ((revMemoryCostUSD / totalCostUSD) * 100).toFixed(1) : '0',
    });

    costBreakdown.push({
      category: '标题生成',
      requestCount: titleGenRequestCount,
      costUSD: titleGenCostUSD.toFixed(6),
      percentage: totalCostUSD > 0 ? ((titleGenCostUSD / totalCostUSD) * 100).toFixed(1) : '0',
    });

    // 计算每日成本（只统计 protochat 供应商）
    const dailyCostMap = new Map<string, number>();
    for (const item of (dailyCostRaw as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.inputTokens || '0');
      const outputTokens = parseInt(item.outputTokens || '0');
      const cost = (inputTokens / 1_000_000) * inputPrice +
        (outputTokens / 1_000_000) * outputPrice;

      const date = item.date;
      dailyCostMap.set(date, (dailyCostMap.get(date) || 0) + cost);
    }

    // 合并每日趋势
    const dailyRevenueMap = new Map((dailyRevenue as any[]).map(d => [d.date, parseFloat(d.revenueCNY || '0')]));
    const allDates = new Set([...dailyRevenueMap.keys(), ...dailyCostMap.keys()]);
    const dailyTrend = Array.from(allDates).sort().map(date => ({
      date,
      revenueCNY: dailyRevenueMap.get(date) || 0,
      costUSD: dailyCostMap.get(date) || 0,
    }));

    return res.json({
      data: {
        overview: {
          totalRevenueCNY,
          totalCostUSD,
          subscriberCount: parseInt((subscriberStats[0] as any)?.subscriberCount || '0'),
          newSubscribers: parseInt((subscriberStats[0] as any)?.newSubscribers || '0'),
        },
        dailyTrend,
        subscriptionRevenue,
        costBreakdown,
      },
      success: true,
    });
  } catch (error) {
    console.error('Analytics revenue error:', error);
    return res.status(500).json({ message: 'Failed to fetch revenue analytics', success: false });
  }
});

// GET /api/admin/analytics/users - 用户洞察
router.get('/users', requirePermission('stats.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { month } = req.query;
    const monthDate = month ? new Date(month as string) : new Date();
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    const startStr = startOfMonth.toISOString();
    const endStr = endOfMonth.toISOString();

    // 获取 ProtoChat 价格映射
    const priceMap = await buildProtochatPriceMap();

    // 1. 用户概览统计
    const userOverview = await db.execute(sql`
      SELECT
        COUNT(DISTINCT u.id) as "totalUsers",
        COUNT(DISTINCT CASE WHEN m.user_id IS NOT NULL THEN u.id END) as "activeUsers",
        COUNT(DISTINCT CASE WHEN ue.current_plan IS NULL OR ue.current_plan IN ('free', 'plan_free') THEN u.id END) as "freeUsers",
        COUNT(DISTINCT CASE WHEN ue.current_plan IS NOT NULL AND ue.current_plan NOT IN ('free', 'plan_free') THEN u.id END) as "paidUsers"
      FROM users u
      LEFT JOIN user_extensions ue ON u.id = ue.user_id
      LEFT JOIN (
        SELECT DISTINCT user_id FROM messages
        WHERE created_at >= ${startStr} AND created_at < ${endStr}
      ) m ON u.id = m.user_id
      WHERE u.email != 'admin@system.local'
    `);

    // 2. 免费用户成本排行（先查询原始数据，后续用JS计算成本）
    const freeUserRawData = await db.execute(sql`
      SELECT
        u.id as "userId",
        u.email,
        u.username,
        m.model,
        m.provider,
        SUM((COALESCE(m.metadata ->> 'totalInputTokens', '0'))::int) as "inputTokens",
        SUM((COALESCE(m.metadata ->> 'totalOutputTokens', '0'))::int) as "outputTokens",
        COUNT(*) as "requestCount"
      FROM messages m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN user_extensions ue ON u.id = ue.user_id
      WHERE m.role = 'assistant'
        AND m.created_at >= ${startStr}
        AND m.created_at < ${endStr}
        AND u.email != 'admin@system.local'
        AND (ue.current_plan IS NULL OR ue.current_plan IN ('free', 'plan_free'))
      GROUP BY u.id, u.email, u.username, m.model, m.provider
    `);

    // 2b. 免费用户图片生成成本（从 user_transactions）
    const freeUserImageData = await db.execute(sql`
      SELECT
        u.id as "userId",
        u.email,
        u.username,
        COUNT(*) as "requestCount",
        ABS(SUM(ut.amount::numeric)) as "totalCost"
      FROM user_transactions ut
      JOIN users u ON ut.user_id = u.id
      LEFT JOIN user_extensions ue ON u.id = ue.user_id
      WHERE ut.type = 'CONSUMPTION'
        AND ut.created_at >= ${startStr}
        AND ut.created_at < ${endStr}
        AND ut.metadata ->> 'type' = 'image'
        AND u.email != 'admin@system.local'
        AND (ue.current_plan IS NULL OR ue.current_plan IN ('free', 'plan_free'))
      GROUP BY u.id, u.email, u.username
    `);

    // 按用户聚合免费用户成本
    const freeUserCostMap = new Map<string, any>();
    for (const item of (freeUserRawData as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.inputTokens || '0');
      const outputTokens = parseInt(item.outputTokens || '0');
      const requestCount = parseInt(item.requestCount || '0');
      const cost = (inputTokens / 1_000_000) * inputPrice +
        (outputTokens / 1_000_000) * outputPrice;

      const userId = item.userId;
      if (!freeUserCostMap.has(userId)) {
        freeUserCostMap.set(userId, {
          userId,
          email: item.email,
          username: item.username,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          requestCount: 0,
          cost: 0,
        });
      }
      const user = freeUserCostMap.get(userId);
      user.inputTokens += inputTokens;
      user.outputTokens += outputTokens;
      user.totalTokens += inputTokens + outputTokens;
      user.requestCount += requestCount;
      user.cost += cost;
    }

    // 添加图片生成成本到免费用户
    for (const item of (freeUserImageData as any[])) {
      const userId = item.userId;
      const requestCount = parseInt(item.requestCount || '0');
      const costInCredits = parseFloat(item.totalCost || '0');
      const costInUSD = costInCredits / 500000;

      if (!freeUserCostMap.has(userId)) {
        freeUserCostMap.set(userId, {
          userId,
          email: item.email,
          username: item.username,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          requestCount: 0,
          cost: 0,
        });
      }
      const user = freeUserCostMap.get(userId);
      user.requestCount += requestCount;
      user.cost += costInUSD;
    }

    // 排序取前20
    const freeUserCostRanking = Array.from(freeUserCostMap.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20);

    // 计算免费用户总成本
    const freeUserTotalCost = freeUserCostRanking.reduce((sum, u) => sum + u.cost, 0);

    // 添加成本占比
    const freeUserCostWithPercentage = freeUserCostRanking.map((u) => ({
      ...u,
      cost: u.cost.toFixed(8),
      costPercentage: freeUserTotalCost > 0 ? ((u.cost / freeUserTotalCost) * 100).toFixed(1) : '0',
    }));

    // 3. 付费用户统计（先查询原始数据，后续用JS计算成本）
    const paidUserRawData = await db.execute(sql`
      SELECT
        u.id as "userId",
        u.email,
        u.username,
        sp.name as "planName",
        sp.monthly_price / 100.0 as "subscriptionCNY",
        m.model,
        m.provider,
        SUM((COALESCE(m.metadata ->> 'totalInputTokens', '0'))::int) as "inputTokens",
        SUM((COALESCE(m.metadata ->> 'totalOutputTokens', '0'))::int) as "outputTokens",
        COUNT(m.id) as "requestCount"
      FROM users u
      JOIN user_extensions ue ON u.id = ue.user_id
      LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
      LEFT JOIN messages m ON u.id = m.user_id AND m.role = 'assistant' AND m.created_at >= ${startStr} AND m.created_at < ${endStr}
      WHERE u.email != 'admin@system.local'
        AND ue.current_plan IS NOT NULL
        AND ue.current_plan NOT IN ('free', 'plan_free')
      GROUP BY u.id, u.email, u.username, sp.name, sp.monthly_price, m.model, m.provider
    `);

    // 3b. 付费用户图片生成成本
    const paidUserImageData = await db.execute(sql`
      SELECT
        u.id as "userId",
        u.email,
        u.username,
        sp.name as "planName",
        sp.monthly_price / 100.0 as "subscriptionCNY",
        COUNT(*) as "requestCount",
        ABS(SUM(ut.amount::numeric)) as "totalCost"
      FROM user_transactions ut
      JOIN users u ON ut.user_id = u.id
      JOIN user_extensions ue ON u.id = ue.user_id
      LEFT JOIN subscription_plans sp ON ue.plan_id = sp.id
      WHERE ut.type = 'CONSUMPTION'
        AND ut.created_at >= ${startStr}
        AND ut.created_at < ${endStr}
        AND ut.metadata ->> 'type' = 'image'
        AND u.email != 'admin@system.local'
        AND ue.current_plan IS NOT NULL
        AND ue.current_plan NOT IN ('free', 'plan_free')
      GROUP BY u.id, u.email, u.username, sp.name, sp.monthly_price
    `);

    // 按用户聚合付费用户数据
    const paidUserMap = new Map<string, any>();
    for (const item of (paidUserRawData as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.inputTokens || '0');
      const outputTokens = parseInt(item.outputTokens || '0');
      const requestCount = parseInt(item.requestCount || '0');
      const cost = (inputTokens / 1_000_000) * inputPrice +
        (outputTokens / 1_000_000) * outputPrice;

      const userId = item.userId;
      if (!paidUserMap.has(userId)) {
        paidUserMap.set(userId, {
          userId,
          email: item.email,
          username: item.username,
          planName: item.planName,
          subscriptionCNY: item.subscriptionCNY,
          totalTokens: 0,
          requestCount: 0,
          cost: 0,
        });
      }
      const user = paidUserMap.get(userId);
      user.totalTokens += inputTokens + outputTokens;
      user.requestCount += requestCount;
      user.cost += cost;
    }

    // 添加图片生成成本到付费用户
    for (const item of (paidUserImageData as any[])) {
      const userId = item.userId;
      const requestCount = parseInt(item.requestCount || '0');
      const costInCredits = parseFloat(item.totalCost || '0');
      const costInUSD = costInCredits / 500000;

      if (!paidUserMap.has(userId)) {
        paidUserMap.set(userId, {
          userId,
          email: item.email,
          username: item.username,
          planName: item.planName,
          subscriptionCNY: item.subscriptionCNY,
          totalTokens: 0,
          requestCount: 0,
          cost: 0,
        });
      }
      const user = paidUserMap.get(userId);
      user.requestCount += requestCount;
      user.cost += costInUSD;
    }

    // 排序取前20
    const paidUserStats = Array.from(paidUserMap.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20);

    // 4. 异常用户检测（用量超过平均值3倍标准差）
    // 先获取原始用户用量数据
    const userUsageRawData = await db.execute(sql`
      SELECT
        m.user_id as "userId",
        m.model,
        m.provider,
        SUM((COALESCE(m.metadata ->> 'totalInputTokens', '0'))::int) as "inputTokens",
        SUM((COALESCE(m.metadata ->> 'totalOutputTokens', '0'))::int) as "outputTokens",
        COUNT(*) as "requestCount"
      FROM messages m
      WHERE m.role = 'assistant'
        AND m.created_at >= ${startStr}
        AND m.created_at < ${endStr}
        AND m.user_id NOT IN (SELECT id FROM users WHERE email = 'admin@system.local')
      GROUP BY m.user_id, m.model, m.provider
    `);

    // 按用户聚合用量
    const userUsageMap = new Map<string, { userId: string; requestCount: number; totalTokens: number; cost: number }>();
    for (const item of (userUsageRawData as any[])) {
      const { inputPrice, outputPrice } = getProtochatModelPrice(item.model, item.provider, priceMap);
      const inputTokens = parseInt(item.inputTokens || '0');
      const outputTokens = parseInt(item.outputTokens || '0');
      const requestCount = parseInt(item.requestCount || '0');
      const cost = (inputTokens / 1_000_000) * inputPrice +
        (outputTokens / 1_000_000) * outputPrice;

      const userId = item.userId;
      if (!userUsageMap.has(userId)) {
        userUsageMap.set(userId, { userId, requestCount: 0, totalTokens: 0, cost: 0 });
      }
      const user = userUsageMap.get(userId)!;
      user.requestCount += requestCount;
      user.totalTokens += inputTokens + outputTokens;
      user.cost += cost;
    }

    const userUsageList = Array.from(userUsageMap.values());

    // 计算平均值和标准差
    const avgRequests = userUsageList.reduce((sum, u) => sum + u.requestCount, 0) / (userUsageList.length || 1);
    const avgTokens = userUsageList.reduce((sum, u) => sum + u.totalTokens, 0) / (userUsageList.length || 1);
    const avgCost = userUsageList.reduce((sum, u) => sum + u.cost, 0) / (userUsageList.length || 1);

    const stddevRequests = Math.sqrt(
      userUsageList.reduce((sum, u) => sum + Math.pow(u.requestCount - avgRequests, 2), 0) / (userUsageList.length || 1)
    );
    const stddevTokens = Math.sqrt(
      userUsageList.reduce((sum, u) => sum + Math.pow(u.totalTokens - avgTokens, 2), 0) / (userUsageList.length || 1)
    );
    const stddevCost = Math.sqrt(
      userUsageList.reduce((sum, u) => sum + Math.pow(u.cost - avgCost, 2), 0) / (userUsageList.length || 1)
    );

    // 找出异常用户
    const anomalyUserIds = userUsageList
      .filter(u =>
        u.requestCount > avgRequests + 3 * Math.max(stddevRequests, 1) ||
        u.totalTokens > avgTokens + 3 * Math.max(stddevTokens, 1) ||
        u.cost > avgCost + 3 * Math.max(stddevCost, 0.001)
      )
      .map(u => u.userId);

    // 获取异常用户详情
    let anomalyUsers: any[] = [];
    if (anomalyUserIds.length > 0) {
      const anomalyUserDetails = await db.execute(sql`
        SELECT
          u.id as "userId",
          u.email,
          u.username,
          ue.current_plan as "planName"
        FROM users u
        LEFT JOIN user_extensions ue ON u.id = ue.user_id
        WHERE u.id = ANY(${anomalyUserIds})
      `);

      anomalyUsers = (anomalyUserDetails as any[]).map(detail => {
        const usage = userUsageMap.get(detail.userId)!;
        let anomalyType = null;
        if (usage.requestCount > avgRequests + 3 * Math.max(stddevRequests, 1)) {
          anomalyType = 'high_request';
        } else if (usage.totalTokens > avgTokens + 3 * Math.max(stddevTokens, 1)) {
          anomalyType = 'high_token';
        } else if (usage.cost > avgCost + 3 * Math.max(stddevCost, 0.001)) {
          anomalyType = 'high_cost';
        }
        const deviationMultiple = stddevCost > 0 ? (usage.cost - avgCost) / stddevCost : 0;

        return {
          ...detail,
          requestCount: usage.requestCount,
          totalTokens: usage.totalTokens,
          cost: usage.cost.toFixed(8),
          avgRequestCount: avgRequests,
          avgTokens: avgTokens,
          deviationMultiple,
          anomalyType,
        };
      }).filter(u => u.anomalyType).sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost)).slice(0, 10);
    }

    return res.json({
      data: {
        overview: {
          totalUsers: parseInt((userOverview[0] as any)?.totalUsers || '0'),
          activeUsers: parseInt((userOverview[0] as any)?.activeUsers || '0'),
          freeUsers: parseInt((userOverview[0] as any)?.freeUsers || '0'),
          paidUsers: parseInt((userOverview[0] as any)?.paidUsers || '0'),
          freeUserTotalCost: freeUserTotalCost.toFixed(6),
          anomalyUserCount: anomalyUsers.length,
        },
        freeUserCostRanking: freeUserCostWithPercentage,
        paidUserStats: paidUserStats.map(u => ({
          ...u,
          cost: u.cost.toFixed(8),
          subscriptionUSD: parseFloat(u.subscriptionCNY || '0') / 7.3, // 默认汇率转换，前端会重新计算
        })),
        anomalyUsers,
      },
      success: true,
    });
  } catch (error) {
    console.error('Analytics users error:', error);
    return res.status(500).json({ message: 'Failed to fetch user analytics', success: false });
  }
});

// GET /api/admin/analytics/exchange-rate - Get current USD/CNY exchange rate
router.get('/exchange-rate', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { refresh } = req.query;

    // Force refresh if requested
    const rate = refresh === 'true' ? await refreshExchangeRate() : await getUSDCNYRate();

    return res.json({
      data: {
        rate,
        from: 'USD',
        to: 'CNY',
        timestamp: new Date().toISOString(),
      },
      success: true,
    });
  } catch (error: any) {
    console.error('Get exchange rate error:', error);
    return res.status(500).json({
      message: 'Failed to fetch exchange rate',
      success: false,
    });
  }
});

export default router;
