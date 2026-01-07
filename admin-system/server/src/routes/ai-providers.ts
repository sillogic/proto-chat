import express, { Router } from 'express';
import { db } from '../config/database';
import { aiProviders } from '../db/ai-providers-schema';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { KeyVaultsGateKeeper } from '../utils/encryption';
import { z } from 'zod';
import { ModelRuntime } from '@lobechat/model-runtime';

const router: Router = express.Router();

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

        // Fetch existing provider to merge settings/config if necessary
        const existingProviders = await db
            .select()
            .from(aiProviders)
            .where(and(eq(aiProviders.id, validation.data.id), eq(aiProviders.isGlobal, true)))
            .limit(1);

        const existing = existingProviders[0];

        const { id, name, enabled, fetchOnClient, logo, description, keyVaults, settings, config } = validation.data;

        const values: any = {
            id,
            isGlobal: true,
            userId: 'system_admin',
            updatedAt: new Date(),
        };

        if (name !== undefined) values.name = name;
        if (enabled !== undefined) values.enabled = enabled;
        if (fetchOnClient !== undefined) values.fetchOnClient = fetchOnClient;
        if (logo !== undefined) values.logo = logo;
        if (description !== undefined) values.description = description;

        if (keyVaults !== undefined) {
            const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
            values.keyVaults = await gateKeeper.encrypt(JSON.stringify(keyVaults));
        }

        if (settings !== undefined) {
            values.settings = { ...(existing?.settings as any || {}), ...settings };
        }

        if (config !== undefined) {
            values.config = { ...(existing?.config as any || {}), ...config };
        }

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

        if (!existing) {
            await db.insert(aiProviders).values({
                ...values,
                createdAt: new Date(),
            });
        } else {
            await db.update(aiProviders)
                .set(values)
                .where(and(eq(aiProviders.id, id), eq(aiProviders.isGlobal, true)));
        }

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

// POST /api/admin/ai-providers/check - 连通性测试
router.post('/check', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id, model, keyVaults: inputKeyVaults } = req.body;

        if (!id || !model) {
            return res.status(400).json({
                message: '供应商 ID 和模型 ID 是必填项',
                success: false,
            });
        }

        let keyVaults = inputKeyVaults;

        // 如果没有提供 keyVaults，尝试从数据库获取
        if (!keyVaults) {
            const provider = await db.select().from(aiProviders).where(eq(aiProviders.id, id)).limit(1);
            if (provider.length > 0 && provider[0].keyVaults) {
                const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
                const result = await gateKeeper.decrypt(provider[0].keyVaults);
                if (result.wasAuthentic) {
                    keyVaults = JSON.parse(result.plaintext);
                }
            }
        }

        if (!keyVaults || !keyVaults.apiKey) {
            return res.status(400).json({
                message: '未找到有效的 API Key 配置',
                success: false,
            });
        }

        const runtime = ModelRuntime.initializeWithProvider(id as any, {
            apiKey: keyVaults.apiKey,
            baseURL: keyVaults.proxyUrl || keyVaults.endpoint,
        });

        // 进行简单的对话测试
        const response = await runtime.chat({
            messages: [{ content: 'hello', role: 'user' }],
            model: model,
            stream: false,
        });

        if (response instanceof Response && !response.ok) {
            const error = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error,
                message: '连通性测试失败',
                success: false,
            });
        }

        return res.json({
            message: '连通性测试通过',
            success: true,
        });
    } catch (error: any) {
        console.error('Connectivity check error:', error);
        return res.status(500).json({
            error: error.message || error,
            message: '连通性测试发生异常',
            success: false,
        });
    }
});

export default router;
