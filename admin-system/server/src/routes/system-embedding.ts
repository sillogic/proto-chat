import express, { Router } from 'express';
import { db } from '../config/database';
import { systemEmbeddingConfig, systemEmbeddingModels, embeddingUsageLogs } from '@lobechat/database';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { KeyVaultsGateKeeper } from '../utils/encryption';
import { z } from 'zod';

const router: Router = express.Router();

// Validation schemas
const updateConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  contextTokens: z.number().optional(),
  currency: z.string().optional(),
  dimensions: z.number().optional(),
  displayName: z.string().optional(),
  inputPrice: z.number().optional(),
  modelId: z.string().optional(), // 可选（首次同步模型前可能还没选择）
  modelsSyncUrl: z.string().optional(),
  providerId: z.string(), // 必填
});

/**
 * GET /api/admin/system-embedding - 获取当前embedding配置
 */
router.get('/', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    const [config] = await db
      .select()
      .from(systemEmbeddingConfig)
      .where(eq(systemEmbeddingConfig.id, 'default'))
      .limit(1);

    if (!config) {
      return res.json({
        data: null,
        success: true,
      });
    }

    // 解密API Key
    let decryptedApiKey: string | undefined;
    if (config.apiKey) {
      try {
        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
        const result = await gateKeeper.decrypt(config.apiKey);
        if (result.wasAuthentic) {
          decryptedApiKey = result.plaintext;
        }
      } catch (e) {
        console.error('Failed to decrypt API key:', e);
      }
    }

    return res.json({
      data: {
        ...config,
        apiKey: decryptedApiKey,
        // 转换 Decimal 类型为 number
        inputPrice: config.inputPrice ? parseFloat(config.inputPrice) : null,
      },
      success: true,
    });
  } catch (error) {
    console.error('Get system embedding config error:', error);
    return res.status(500).json({
      message: '获取Embedding配置失败',
      success: false,
    });
  }
});

/**
 * POST /api/admin/system-embedding - 更新embedding配置
 */
router.post('/', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    // 放宽验证：modelId可以为空字符串（用于首次配置同步模型前）
    const validation = updateConfigSchema.safeParse(req.body);
    if (!validation.success) {
      console.error('[Embedding] Validation error:', validation.error.errors);
      return res.status(400).json({
        errors: validation.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
        message: '输入数据无效',
        success: false,
      });
    }

    const data = validation.data;
    const now = new Date();

    // 加密API Key
    let encryptedApiKey: string | undefined;
    if (data.apiKey) {
      const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
      encryptedApiKey = await gateKeeper.encrypt(data.apiKey);
    }

    const values: any = {
      baseUrl: data.baseUrl,
      contextTokens: data.contextTokens,
      currency: data.currency || 'USD',
      dimensions: data.dimensions || 1024,
      displayName: data.displayName,
      id: 'default',
      inputPrice: data.inputPrice?.toFixed(4),
      modelId: data.modelId || 'placeholder-will-be-replaced', // 使用占位符如果没提供
      modelsSyncUrl: data.modelsSyncUrl,
      providerId: data.providerId,
      updatedAt: now,
    };

    if (encryptedApiKey) {
      values.apiKey = encryptedApiKey;
    }

    // 检查是否已存在配置
    const [existing] = await db
      .select()
      .from(systemEmbeddingConfig)
      .where(eq(systemEmbeddingConfig.id, 'default'))
      .limit(1);

    if (existing) {
      await db
        .update(systemEmbeddingConfig)
        .set(values)
        .where(eq(systemEmbeddingConfig.id, 'default'));
    } else {
      await db.insert(systemEmbeddingConfig).values({
        ...values,
        createdAt: now,
      });
    }

    return res.json({
      message: 'Embedding配置更新成功',
      success: true,
    });
  } catch (error) {
    console.error('Update system embedding config error:', error);
    return res.status(500).json({
      message: '更新Embedding配置失败',
      success: false,
    });
  }
});

/**
 * GET /api/admin/system-embedding/models - 获取embedding模型列表
 */
router.get('/models', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    const models = await db
      .select()
      .from(systemEmbeddingModels)
      .orderBy(desc(systemEmbeddingModels.syncedAt));

    // 转换 Decimal 类型为 number
    const formattedModels = models.map((m) => ({
      ...m,
      inputPrice: m.inputPrice ? parseFloat(m.inputPrice) : null,
    }));

    return res.json({
      data: formattedModels,
      success: true,
    });
  } catch (error) {
    console.error('Get embedding models error:', error);
    return res.status(500).json({
      message: '获取模型列表失败',
      success: false,
    });
  }
});

/**
 * POST /api/admin/system-embedding/sync - 同步embedding模型列表
 */
router.post('/sync', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    // 获取当前配置
    const [config] = await db
      .select()
      .from(systemEmbeddingConfig)
      .where(eq(systemEmbeddingConfig.id, 'default'))
      .limit(1);

    if (!config) {
      return res.status(400).json({
        message: '请先配置Embedding供应商',
        success: false,
      });
    }

    if (!config.modelsSyncUrl) {
      return res.status(400).json({
        message: '未配置模型同步地址',
        success: false,
      });
    }

    // 解密API Key
    let apiKey: string | undefined;
    if (config.apiKey) {
      try {
        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
        const result = await gateKeeper.decrypt(config.apiKey);
        if (result.wasAuthentic) {
          apiKey = result.plaintext;
        }
      } catch (e) {
        console.error('Failed to decrypt API key:', e);
      }
    }

    console.log(`[Embedding] Syncing models from: ${config.modelsSyncUrl}`);

    // 调用API获取模型列表
    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(config.modelsSyncUrl, { headers });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const models = result.data || [];

    // 筛选出embedding类型的模型
    const embeddingModels = models.filter((m: any) => {
      // OpenRouter格式检查 - 最准确的方式
      // embedding模型的modality应该是 "text->embedding" 或 "text+image->embedding"
      const modality = m.architecture?.modality;
      if (modality && modality.includes('embedding')) return true;

      // 通用格式检查
      if (m.type === 'embedding') return true;

      // 模型ID包含embedding关键词（作为后备方案）
      const modelId = (m.id || '').toLowerCase();
      if (
        modelId.includes('embed') &&
        !modelId.includes('chat') &&
        !modelId.includes('completion')
      ) {
        return true;
      }

      return false;
    });

    console.log(`[Embedding] Found ${embeddingModels.length} embedding models out of ${models.length} total`);

    if (embeddingModels.length === 0) {
      // 打印一些样本模型来帮助调试
      console.log('[Embedding] Sample models from API:', models.slice(0, 3).map((m: any) => ({
        id: m.id,
        architecture: m.architecture,
        type: m.type,
      })));

      return res.status(404).json({
        message: '未找到可用的embedding模型。请检查API返回的模型列表中是否包含embedding类型的模型。',
        success: false,
      });
    }

    // 打印找到的embedding模型（用于验证）
    console.log('[Embedding] Syncing models:', embeddingModels.map((m: any) => m.id).join(', '));

    // 清空旧数据
    await db.delete(systemEmbeddingModels).where(eq(systemEmbeddingModels.providerId, config.providerId));

    // 插入新模型
    const now = new Date();
    for (const model of embeddingModels) {
      // OpenRouter格式处理
      const modelId = model.id;
      const displayName = model.name || modelId;
      const contextTokens = model.context_length || model.contextLength || null;

      // 提取定价信息（OpenRouter的定价在pricing对象中）
      const pricing = model.pricing || {};
      const inputPrice = pricing.prompt ? parseFloat(pricing.prompt) * 1_000_000 : null; // 转换为每百万tokens的价格

      await db.insert(systemEmbeddingModels).values({
        contextTokens,
        createdAt: now,
        currency: 'USD',
        dimensions: 1024, // 默认值，OpenRouter API不提供此信息
        displayName,
        inputPrice: inputPrice?.toFixed(4),
        modelId,
        providerId: config.providerId,
        syncedAt: now,
      });
    }

    // 更新配置的最后同步时间
    await db
      .update(systemEmbeddingConfig)
      .set({
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(systemEmbeddingConfig.id, 'default'));

    console.log(`[Embedding] Sync completed: ${embeddingModels.length} models`);

    return res.json({
      data: {
        syncedModels: embeddingModels.length,
      },
      message: `同步成功！已同步 ${embeddingModels.length} 个embedding模型`,
      success: true,
    });
  } catch (error: any) {
    console.error('[Embedding] Sync failed:', error);
    return res.status(500).json({
      message: error.message || '同步失败',
      success: false,
    });
  }
});

/**
 * POST /api/admin/system-embedding/test - 测试embedding连接
 */
router.post('/test', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    const { apiKey, baseUrl, modelId } = req.body;

    if (!apiKey || !baseUrl || !modelId) {
      return res.status(400).json({
        message: 'API Key、Base URL和模型ID都是必填项',
        success: false,
      });
    }

    console.log(`[Embedding] Testing connection: ${baseUrl} with model ${modelId}`);

    // 构建请求
    const testUrl = `${baseUrl}/embeddings`;
    const headers: any = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = {
      input: 'Hello, this is a test.',
      model: modelId,
      encoding_format: 'float',
    };

    const startTime = Date.now();
    const response = await fetch(testUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Embedding] Test failed:', errorData);

      return res.status(response.status).json({
        details: errorData,
        message: `连接测试失败: ${errorData.error?.message || response.statusText}`,
        success: false,
      });
    }

    const result = await response.json();

    console.log(`[Embedding] Test successful in ${duration}ms`);

    return res.json({
      data: {
        duration: `${duration}ms`,
        embeddingDimensions: result.data?.[0]?.embedding?.length || 0,
        model: result.model,
        usage: result.usage,
      },
      message: '连接测试成功！',
      success: true,
    });
  } catch (error: any) {
    console.error('[Embedding] Test error:', error);
    return res.status(500).json({
      message: error.message || '测试连接时发生错误',
      success: false,
    });
  }
});

/**
 * GET /api/admin/system-embedding/usage - 获取embedding使用统计
 */
router.get('/usage', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const logs = await db
      .select()
      .from(embeddingUsageLogs)
      .orderBy(desc(embeddingUsageLogs.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // 转换 Decimal 类型为 number
    const formattedLogs = logs.map((log) => ({
      ...log,
      costPrice: log.costPrice ? parseFloat(log.costPrice) : null,
      userPrice: log.userPrice ? parseFloat(log.userPrice) : null,
    }));

    return res.json({
      data: formattedLogs,
      success: true,
    });
  } catch (error) {
    console.error('Get embedding usage logs error:', error);
    return res.status(500).json({
      message: '获取使用日志失败',
      success: false,
    });
  }
});

export default router;
