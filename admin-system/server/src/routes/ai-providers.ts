import express, { Router } from 'express';
import { db } from '../config/database';
import { aiProviders, aiModels } from '../db/ai-providers-schema';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { KeyVaultsGateKeeper } from '../utils/encryption';
import { z } from 'zod';
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';
import { AdapterFactory } from '../utils/model-sync-adapters';

const router: Router = express.Router();

const upsertProviderSchema = z.object({
    config: z.record(z.any()).optional(),
    description: z.string().nullable().optional(),
    enabled: z.boolean().default(true),
    fetchOnClient: z.boolean().default(false),
    id: z.string(),
    keyVaults: z.record(z.any()).optional(),
    logo: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
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
                // 只有当 keyVaults 存在且是加密格式（包含至少两个冒号）时才解密
                if (p.keyVaults && typeof p.keyVaults === 'string' && p.keyVaults.includes(':')) {
                    try {
                        const result = await gateKeeper.decrypt(p.keyVaults);
                        if (result.wasAuthentic) {
                            keyVaults = JSON.parse(result.plaintext);
                        }
                    } catch (e) {
                        console.error(`Failed to decrypt keyVaults for ${p.id}:`, e);
                    }
                }
                // ProtoChat 不需要 keyVaults，保持为空对象
                return {
                    ...p,
                    keyVaults, // 返回解密后的对象，用于编辑
                };
            })
        );

        // 检查是否有 ProtoChat，如果没有则添加默认启用的 ProtoChat
        const hasProtoChat = decryptedProviders.some(p => p.id === 'protochat');
        if (!hasProtoChat) {
            decryptedProviders.push({
                id: 'protochat',
                name: 'ProtoChat',
                enabled: true,
                fetchOnClient: false,
                isGlobal: true,
                userId: 'system_admin',
                keyVaults: {},
                settings: {},
                config: {},
                logo: null,
                description: 'ProtoChat 统一计费网关',
                checkModel: null,
                sort: null,
                source: 'builtin' as const,
                pricingSyncStrategy: null,
                pricingApiUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

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

        if (name !== undefined && name !== null) values.name = name;
        if (enabled !== undefined) values.enabled = enabled;
        if (fetchOnClient !== undefined) values.fetchOnClient = fetchOnClient;
        if (logo !== undefined && logo !== null) values.logo = logo;
        if (description !== undefined && description !== null) values.description = description;

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

        // 使用 require 动态导入 ModelRuntime
        const { ModelRuntime } = require('@lobechat/model-runtime');

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

        // 检查是否是模型不存在/已下架的错误
        const is404Error = error?.error?.code === 404 || error?.statusCode === 404;
        const isModelNotFound = error?.error?.message?.includes('No endpoints found') ||
                                error?.message?.includes('not found') ||
                                error?.message?.includes('model not found');

        if (is404Error || isModelNotFound) {
            return res.status(404).json({
                error: error.message || error,
                message: '该模型可能已经下架或不存在，请尽快更新模型列表',
                success: false,
            });
        }

        return res.status(500).json({
            error: error.message || error,
            message: '连通性测试发生异常',
            success: false,
        });
    }
});

// GET /api/admin/models?provider=xxx - 获取某个供应商的模型列表
router.get('/models', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { provider } = req.query;

        if (!provider || typeof provider !== 'string') {
            return res.status(400).json({
                message: 'Provider ID is required',
                success: false,
            });
        }

        const models = await db
            .select()
            .from(aiModels)
            .where(and(eq(aiModels.providerId, provider), eq(aiModels.userId, 'system_admin')));

        // 转换为前端期望的格式
        const formattedModels = models.map((m) => {
            const abilities = m.abilities as any || {};
            const pricing = m.pricing as any || {};
            const params = m.parameters as any || {};

            return {
                id: m.id,
                displayName: m.displayName || m.id,
                description: m.description,
                type: m.type || 'chat',
                enabled: m.enabled,
                contextWindowTokens: m.contextWindowTokens,
                abilities: {
                    functionCall: abilities.functionCall || false,
                    vision: abilities.vision || false,
                    video: abilities.video || false,
                    audio: abilities.audio || false,
                    reasoning: abilities.reasoning || false,
                    search: abilities.search || false,
                    structuredOutput: abilities.structuredOutput || false,
                    streaming: abilities.streaming || false,
                },
                pricing: {
                    input: pricing.inputPrice || 0,
                    output: pricing.outputPrice || 0,
                    currency: pricing.currency || 'USD',
                    isFree: pricing.isFree || false,
                },
                releasedAt: m.releasedAt,
                source: m.source,
            };
        });

        return res.json({
            data: formattedModels,
            success: true,
        });
    } catch (error) {
        console.error('Get models error:', error);
        return res.status(500).json({
            message: '获取模型列表失败',
            success: false,
        });
    }
});

// POST /api/admin/providers/:id/test-api - 测试 API（不写入数据库）
router.post('/providers/:id/test-api', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { apiUrl } = req.body;

        if (!apiUrl) {
            return res.status(400).json({
                message: 'API URL is required',
                success: false,
            });
        }

        console.log(`[${id}] Testing API: ${apiUrl}`);
        const startTime = Date.now();

        // 获取供应商配置（用于获取 API Key）
        const provider = await db
            .select()
            .from(aiProviders)
            .where(and(eq(aiProviders.id, id), eq(aiProviders.isGlobal, true)))
            .limit(1);

        let apiKey: string | undefined;
        if (provider.length > 0 && provider[0].keyVaults) {
            try {
                const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
                const result = await gateKeeper.decrypt(provider[0].keyVaults);
                if (result.wasAuthentic) {
                    const keyVaults = JSON.parse(result.plaintext);
                    apiKey = keyVaults.apiKey;
                }
            } catch (e) {
                console.error('Failed to decrypt API key:', e);
            }
        }

        const models = await AdapterFactory.fetchAndAdapt(apiUrl, id, id, apiKey);
        const duration = `${Date.now() - startTime}ms`;

        console.log(`[${id}] API test successful: ${models.length} models`);

        // 统计信息
        const modelTypes = models.reduce((acc: any, model: any) => {
            acc[model.type] = (acc[model.type] || 0) + 1;
            return acc;
        }, {});

        return res.json({
            success: true,
            message: 'API 测试成功',
            data: {
                totalModels: models.length,
                freeModels: models.filter((m: any) => m.pricing.isFree).length,
                paidModels: models.filter((m: any) => !m.pricing.isFree).length,
                modelTypes,
                duration,
                adapter: apiUrl.includes('openrouter.ai') ? 'OpenRouter' : 'Generic',
            },
        });
    } catch (error: any) {
        console.error(`[${req.params.id}] API test failed:`, error);
        return res.status(500).json({
            success: false,
            message: error.message || 'API 测试失败',
        });
    }
});

// POST /api/admin/providers/:id/sync - 同步模型列表
router.post('/providers/:id/sync', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`[${id}] Starting model sync...`);

        // 获取供应商配置
        const provider = await db
            .select()
            .from(aiProviders)
            .where(and(eq(aiProviders.id, id), eq(aiProviders.isGlobal, true)))
            .limit(1);

        if (provider.length === 0) {
            return res.status(404).json({
                message: `供应商 "${id}" 不存在`,
                success: false,
            });
        }

        const pricingApiUrl = provider[0].pricingApiUrl;
        let syncedModels: any[] = [];

        // 尝试从 API 同步
        if (pricingApiUrl) {
            try {
                console.log(`[${id}] Syncing from API: ${pricingApiUrl}`);

                let apiKey: string | undefined;
                if (provider[0].keyVaults) {
                    try {
                        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
                        const result = await gateKeeper.decrypt(provider[0].keyVaults);
                        if (result.wasAuthentic) {
                            const keyVaults = JSON.parse(result.plaintext);
                            apiKey = keyVaults.apiKey;
                        }
                    } catch (e) {
                        console.error('Failed to decrypt API key:', e);
                    }
                }

                syncedModels = await AdapterFactory.fetchAndAdapt(pricingApiUrl, id, id, apiKey);
                console.log(`[${id}] 获取到 ${syncedModels.length} 个模型`);
            } catch (error: any) {
                console.error(`[${id}] API 同步失败，降级到 model-bank:`, error.message);
            }
        }

        // 降级：从 model-bank 同步
        if (syncedModels.length === 0) {
            console.log(`[${id}] 从 Model-Bank 同步模型`);
            const bankModels = LOBE_DEFAULT_MODEL_LIST.filter((m: any) => m.providerId === id);

            if (bankModels.length === 0) {
                return res.status(404).json({
                    message: `供应商 "${id}" 在 Model-Bank 中没有可用模型`,
                    success: false,
                });
            }

            // 转换 model-bank 格式
            syncedModels = bankModels.map((m: any) => ({
                id: m.id,
                originalId: `${id}::${m.id}`,
                displayName: m.displayName || m.id,
                type: m.type || 'chat',
                capabilities: m.abilities || {},
                contextTokens: m.contextWindowTokens || null,
                maxOutput: null,
                parameters: {},
                pricing: {
                    inputPrice: 0,
                    outputPrice: 0,
                    isFree: true,
                    currency: 'USD',
                },
                settings: {
                    description: m.description,
                    releasedAt: m.releasedAt,
                },
            }));
        }

        // 保存当前启用的模型 ID 列表
        const currentModels = await db
            .select()
            .from(aiModels)
            .where(and(eq(aiModels.providerId, id), eq(aiModels.userId, 'system_admin')));

        const enabledModelIds = currentModels
            .filter((m) => m.enabled)
            .map((m) => m.id);

        // 删除旧模型
        await db
            .delete(aiModels)
            .where(and(eq(aiModels.providerId, id), eq(aiModels.userId, 'system_admin')));

        // 插入新模型
        for (const model of syncedModels) {
            const wasEnabled = enabledModelIds.includes(model.id);

            await db.insert(aiModels).values({
                id: model.id,
                displayName: model.displayName,
                description: model.settings?.description || null,
                providerId: id,
                type: model.type,
                enabled: wasEnabled,
                userId: 'system_admin',
                contextWindowTokens: model.contextTokens,
                pricing: model.pricing,
                parameters: model.parameters,
                abilities: model.capabilities,
                releasedAt: model.settings?.releasedAt || null,
                source: pricingApiUrl ? 'remote' : 'builtin',
                settings: model.settings || {},
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        // 更新供应商的 lastSyncedAt
        await db
            .update(aiProviders)
            .set({
                settings: {
                    ...(provider[0].settings as any || {}),
                    lastSyncedAt: new Date().toISOString(),
                },
                updatedAt: new Date(),
            })
            .where(and(eq(aiProviders.id, id), eq(aiProviders.isGlobal, true)));

        console.log(`[${id}] Sync completed: ${syncedModels.length} models`);

        return res.json({
            success: true,
            message: `同步成功！已同步 ${syncedModels.length} 个模型`,
            data: {
                syncedModels: syncedModels.length,
                source: pricingApiUrl ? 'api' : 'model-bank',
            },
        });
    } catch (error: any) {
        console.error(`[${req.params.id}] Sync failed:`, error);
        return res.status(500).json({
            success: false,
            message: error.message || '同步失败',
        });
    }
});

export default router;
