import express, { Router } from 'express';
import { db } from '../config/database';
import { systemAdminParams } from '../db/system-config-schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { z } from 'zod';

const router: Router = express.Router();

// 默认参数定义（首次读取时若数据库无记录则返回默认值）
const PARAM_DEFAULTS: Record<string, { value: string; description: string }> = {
  usd_cny_rate: { value: '7.3', description: 'USD/CNY 汇率，用于数据分析页人民币收入转美元' },
};

/**
 * GET /api/admin/system-config/params - 获取所有参数（或单个参数）
 */
router.get('/', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    const { key } = req.query;

    if (key && typeof key === 'string') {
      const [row] = await db
        .select()
        .from(systemAdminParams)
        .where(eq(systemAdminParams.key, key))
        .limit(1);

      const value = row?.value ?? PARAM_DEFAULTS[key]?.value ?? null;
      return res.json({
        data: { key, value },
        success: true,
      });
    }

    const rows = await db.select().from(systemAdminParams);

    // 合并默认值（数据库中没有的 key 补上默认值）
    const merged = { ...PARAM_DEFAULTS };
    for (const row of rows) {
      merged[row.key] = { value: row.value, description: row.description || '' };
    }

    return res.json({
      data: Object.entries(merged).map(([k, v]) => ({
        description: v.description,
        key: k,
        value: v.value,
      })),
      success: true,
    });
  } catch (error) {
    console.error('Get system admin params error:', error);
    return res.status(500).json({ message: '获取参数失败', success: false });
  }
});

/**
 * POST /api/admin/system-config/params - 更新一个参数
 */
router.post('/', authenticateToken, requirePermission('system.admin'), async (req, res) => {
  try {
    const schema = z.object({
      key: z.string().min(1).max(100),
      value: z.string(),
    });
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        message: '输入数据无效',
        success: false,
      });
    }

    const { key, value } = validation.data;
    const description = PARAM_DEFAULTS[key]?.description ?? '';
    const now = new Date();

    const [existing] = await db
      .select()
      .from(systemAdminParams)
      .where(eq(systemAdminParams.key, key))
      .limit(1);

    if (existing) {
      await db
        .update(systemAdminParams)
        .set({ updatedAt: now, value })
        .where(eq(systemAdminParams.key, key));
    } else {
      await db.insert(systemAdminParams).values({ description, key, updatedAt: now, value });
    }

    return res.json({ data: { key, value }, message: '参数更新成功', success: true });
  } catch (error) {
    console.error('Update system admin param error:', error);
    return res.status(500).json({ message: '更新参数失败', success: false });
  }
});

export default router;
