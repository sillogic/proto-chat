import express, { Router } from 'express';
import { db } from '../config/database';
import { systemDefaultModelConfig } from '../db/system-config-schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { z } from 'zod';

const router: Router = express.Router();

// Validation schemas
const updateConfigSchema = z.object({
  displayName: z.string(),
  modelId: z.string(),
  providerId: z.string(),
  providerName: z.string(),
});

/**
 * GET /api/admin/system-config/default-model - 获取当前默认模型配置
 */
router.get('/', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    const [config] = await db
      .select()
      .from(systemDefaultModelConfig)
      .where(eq(systemDefaultModelConfig.id, 'default'))
      .limit(1);

    return res.json({
      data: config || null,
      success: true,
    });
  } catch (error) {
    console.error('Get system default model config error:', error);
    return res.status(500).json({
      message: '获取默认模型配置失败',
      success: false,
    });
  }
});

/**
 * POST /api/admin/system-config/default-model - 更新默认模型配置
 */
router.post('/', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    const validation = updateConfigSchema.safeParse(req.body);
    if (!validation.success) {
      console.error('[DefaultModel] Validation error:', validation.error.errors);
      return res.status(400).json({
        errors: validation.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
        message: '输入数据无效',
        success: false,
      });
    }

    const data = validation.data;
    const now = new Date();

    const values = {
      displayName: data.displayName,
      id: 'default',
      modelId: data.modelId,
      providerId: data.providerId,
      providerName: data.providerName,
      updatedAt: now,
    };

    // 检查是否已存在配置
    const [existing] = await db
      .select()
      .from(systemDefaultModelConfig)
      .where(eq(systemDefaultModelConfig.id, 'default'))
      .limit(1);

    if (existing) {
      await db
        .update(systemDefaultModelConfig)
        .set(values)
        .where(eq(systemDefaultModelConfig.id, 'default'));
    } else {
      await db.insert(systemDefaultModelConfig).values({
        ...values,
        createdAt: now,
      });
    }

    // 返回更新后的配置
    const [updatedConfig] = await db
      .select()
      .from(systemDefaultModelConfig)
      .where(eq(systemDefaultModelConfig.id, 'default'))
      .limit(1);

    return res.json({
      data: updatedConfig,
      message: '默认模型配置更新成功',
      success: true,
    });
  } catch (error) {
    console.error('Update system default model config error:', error);
    return res.status(500).json({
      message: '更新默认模型配置失败',
      success: false,
    });
  }
});

export default router;
