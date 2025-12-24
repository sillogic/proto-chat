import express from 'express';
import { db } from '../config/database';
import { aiProviders } from '../db/ai-providers-schema';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { KeyVaultsGateKeeper } from '../utils/encryption';
import { z } from 'zod';

const router = express.Router();

const upsertProviderSchema = z.object({
    config: z.record(z.any()).optional(),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
    fetchOnClient: z.boolean().default(false),
    id: z.string(),
    keyVaults: z.record(z.any()).optional(),
    logo: z.string().optional(),
    name: z.string().optional(),
    settings: z.record(z.any()).optional(),
});

// GET /api/admin/ai-providers - 获取所有全局供应商配置
router.get('/', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const providers = await db
            .select()
            .from(aiProviders)
            .where(eq(aiProviders.isGlobal, true));

        // 对 keyVaults 进行脱敏处理或解密（如果需要显示）
        // 通常列表页不返回密钥，或者返回已加密的字符串
        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();

        const decryptedProviders = await Promise.all(
            providers.map(async (p) => {
                let keyVaults = {};
                if (p.keyVaults) {
                    try {
                        const result = await gateKeeper.decrypt(p.keyVaults);
                        if (result.wasAuthentic) {
                            keyVaults = JSON.parse(result.plaintext);
                        }
                    } catch (e) {
                        console.error(`Failed to decrypt keyVaults for ${p.id}:`, e);
                    }
                }
                return {
                    ...p,
                    keyVaults, // 返回解密后的对象，用于编辑
                };
            })
        );

        return res.json({
            data: decryptedProviders,
            success: true,
        });
    } catch (error) {
        console.error('Get global ai providers error:', error);
        return res.status(500).json({
            message: '获取全局供应商配置失败',
            success: false,
        });
    }
});

// POST /api/admin/ai-providers - 创建或更新全局供应商配置
router.post('/', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const validation = upsertProviderSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.errors.map(err => err.message),
                message: '输入数据无效',
                success: false,
            });
        }

        const { id, name, enabled, fetchOnClient, logo, description, keyVaults, settings, config } = validation.data;

        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
        const encryptedKeyVaults = keyVaults ? await gateKeeper.encrypt(JSON.stringify(keyVaults)) : null;

        const values = {

            config: config || {},


            description,

            // 全局配置使用固定的 userId
            enabled,
            fetchOnClient,
            id,
            isGlobal: true,
            keyVaults: encryptedKeyVaults,
            logo,
            name,
            settings: settings || {},
            updatedAt: new Date(),
            userId: 'system_admin',
        };

        // 确保 system_admin 用户存在
        const systemAdminExists = await db.select().from(users).where(eq(users.id, 'system_admin')).limit(1);
        if (systemAdminExists.length === 0) {
            await db.insert(users).values({
                id: 'system_admin',
                username: 'system_admin',
                email: 'admin@system.local',
                fullName: 'System Admin',
                emailVerified: true,
                role: 'admin',
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        await db.insert(aiProviders)
            .values({
                ...values,
                createdAt: new Date(),
            })
            .onConflictDoUpdate({
                set: values,
                target: [aiProviders.id, aiProviders.userId],
            });

        return res.json({
            message: '全局供应商配置更新成功',
            success: true,
        });
    } catch (error) {
        console.error('Upsert global ai provider error:', error);
        return res.status(500).json({
            message: '更新全局供应商配置失败',
            success: false,
        });
    }
});

// DELETE /api/admin/ai-providers/:id - 删除全局供应商配置
router.delete('/:id', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;
        await db.delete(aiProviders)
            .where(and(eq(aiProviders.id, id), eq(aiProviders.isGlobal, true)));

        return res.json({
            message: '全局供应商配置已删除',
            success: true,
        });
    } catch (error) {
        console.error('Delete global ai provider error:', error);
        return res.status(500).json({
            message: '删除全局供应商配置失败',
            success: false,
        });
    }
});

export default router;
