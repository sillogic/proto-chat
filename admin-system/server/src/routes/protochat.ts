import express, { Router } from 'express';
import { db } from '../config/database';
import {
    protochatProviders,
    protochatModels,
    protochatModelPricing,
    protochatSettings,
    protochatUsageLogs,
} from '../db/protochat-schema';
import { eq, ne, desc, and, like, sql } from 'drizzle-orm';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { KeyVaultsGateKeeper } from '../utils/encryption';
import { z } from 'zod';
import { PricingService } from '../services/pricing-service';
import { AdapterFactory, UnifiedModelData } from '../utils/model-sync-adapters';
import { generateUniqueAlias } from '../utils/alias-generator';
import type { Response } from 'express';
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';

const router: Router = express.Router();
const pricingService = new PricingService();

// =============================================
// AI Providers Compatibility Layer (兼容全局AI服务商接口)
// =============================================

// GET /api/admin/protochat/ai-providers - 以AiProvider格式返回protochat供应商
router.get('/ai-providers', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const providers = await db
            .select()
            .from(protochatProviders)
            .orderBy(protochatProviders.priority);

        // 初始化加密工具用于解密 API Key
        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();

        // 转换为 AiProvider 格式，并解密 keyVaults
        const aiProviderFormat = await Promise.all(providers.map(async (p) => {
            let keyVaults = {};

            // 解密 API Key（如果存在）
            if (p.apiKey) {
                try {
                    const result = await gateKeeper.decrypt(p.apiKey);
                    if (result.wasAuthentic) {
                        keyVaults = JSON.parse(result.plaintext);
                    }
                } catch (e) {
                    console.error(`Failed to decrypt apiKey for ${p.id}:`, e);
                }
            }

            return {
                id: p.id,
                name: p.name || p.id,
                enabled: p.enabled,
                fetchOnClient: false,
                logo: null,
                description: `${p.type === 'aggregator' ? '聚合平台' : '直连供应商'} - 优先级: ${p.priority}`,
                keyVaults, // 返回解密后的对象
                settings: {
                    ...(p.settings || {}),
                    baseUrl: p.baseUrl,
                    pricingSyncStrategy: p.pricingSyncStrategy,
                    pricingApiUrl: p.pricingApiUrl,
                },
                config: {},
                isGlobal: true, // ProtoChat providers are treated as global
                createdAt: p.createdAt?.toISOString(),
                updatedAt: p.updatedAt?.toISOString(),
            };
        }));

        return res.json({
            data: aiProviderFormat,
            success: true,
        });
    } catch (error) {
        console.error('Get protochat ai providers error:', error);
        return res.status(500).json({
            message: '获取ProtoChat AI服务商失败',
            success: false,
        });
    }
});

// POST /api/admin/protochat/ai-providers - 以AiProvider格式创建/更新protochat供应商
router.post('/ai-providers', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id, name, enabled, keyVaults, settings } = req.body;

        console.log('[ProtoChat POST] Received request:', {
            id,
            name,
            enabled,
            keyVaults: keyVaults ? '[REDACTED]' : null, // 不记录敏感信息
            settings,
        });

        if (!id) {
            return res.status(400).json({
                message: 'Provider ID is required',
                success: false,
            });
        }

        // 从 settings 提取 protochat 特定字段
        const baseUrl = settings?.baseUrl || null;
        const pricingSyncStrategy = settings?.pricingSyncStrategy || 'model_bank';
        const pricingApiUrl = settings?.pricingApiUrl || null;

        // 保留settings中的其他字段（如lastSyncedAt）
        const processedSettings = settings ? { ...settings } : {};

        const providerData: any = {
            id,
            name: name || id,
            type: 'aggregator', // default
            enabled: enabled !== undefined ? enabled : true,
            priority: 0,
            baseUrl,
            pricingSyncStrategy,
            pricingApiUrl,
            settings: processedSettings,
            updatedAt: new Date(),
        };

        // 加密 API Key（如果提供了 keyVaults）
        if (keyVaults && Object.keys(keyVaults).length > 0) {
            const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
            providerData.apiKey = await gateKeeper.encrypt(JSON.stringify(keyVaults));
        }

        console.log('[ProtoChat POST] Provider data to save (apiKey encrypted):', {
            ...providerData,
            apiKey: providerData.apiKey ? '[ENCRYPTED]' : null,
        });

        // Upsert
        const existing = await db
            .select()
            .from(protochatProviders)
            .where(eq(protochatProviders.id, id))
            .limit(1);

        if (existing.length > 0) {
            await db
                .update(protochatProviders)
                .set(providerData)
                .where(eq(protochatProviders.id, id));
        } else {
            // 新建供应商时自动生成别名
            const existingProviders = await db
                .select({ alias: protochatProviders.alias })
                .from(protochatProviders);
            const existingAliases = new Set(
                existingProviders.map(p => p.alias).filter(Boolean) as string[]
            );
            const alias = generateUniqueAlias(existingAliases);

            await db.insert(protochatProviders).values({
                ...providerData,
                alias,
                createdAt: new Date(),
            });
        }

        return res.json({
            message: '保存成功',
            success: true,
        });
    } catch (error) {
        console.error('Upsert protochat ai provider error:', error);
        return res.status(500).json({
            message: '保存AI服务商失败',
            success: false,
        });
    }
});

// POST /api/admin/protochat/ai-providers/check - 连通性测试
router.post('/ai-providers/check', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    // 在 try 块外声明变量，确保 catch 块中可访问
    let id: string = '';
    let model: string = '';
    let inputKeyVaults: any;
    let originalId: string | undefined;

    try {
        ({ id, model, keyVaults: inputKeyVaults, originalId } = req.body);

        if (!id || !model) {
            return res.status(400).json({
                message: '供应商 ID 和模型 ID 是必填项',
                success: false,
            });
        }

        let keyVaults = inputKeyVaults;

        // 如果没有提供 keyVaults，尝试从数据库获取
        if (!keyVaults) {
            const provider = await db
                .select()
                .from(protochatProviders)
                .where(eq(protochatProviders.id, id))
                .limit(1);

            if (provider.length > 0 && provider[0].apiKey) {
                const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
                const result = await gateKeeper.decrypt(provider[0].apiKey);
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

        // 解析原始模型ID和供应商类型
        // 支持的格式：
        // 1. protochat::{alias}::{modelId} - ProtoChat封装格式
        // 2. {originalProvider}::{modelId} - originalId格式
        // 3. {modelId} - 原始模型ID
        let actualModelId = model;
        let actualProviderType = id;

        // 如果提供了 originalId，解析它
        if (originalId && typeof originalId === 'string' && originalId.includes('::')) {
            const parts = originalId.split('::');
            if (parts.length >= 2) {
                actualProviderType = parts[0];
                actualModelId = parts.slice(1).join('::');
            }
        }
        // 如果 model 是 protochat:: 格式，也解析
        else if (model.startsWith('protochat::') && model.includes('::')) {
            const parts = model.split('::');
            if (parts.length >= 3) {
                // protochat::alias::modelId -> 需要 alias 对应的原始供应商
                // 这种情况下需要从数据库获取供应商信息
                const provider = await db
                    .select()
                    .from(protochatProviders)
                    .where(eq(protochatProviders.id, id))
                    .limit(1);

                if (provider.length > 0) {
                    const providerData = provider[0];
                    // 如果供应商有配置的原始供应商类型，使用它
                    const settings = providerData.settings as any || {};
                    actualProviderType = settings.originalProvider || id;
                }
                actualModelId = parts.slice(2).join('::');
            }
        }

        // 供应商 ID 到 ModelRuntime Provider 类型的映射
        const providerTypeMap: Record<string, string> = {
            'openai': 'openai',
            'openaicom': 'openai',
            'azure': 'azure',
            'deepseek': 'deepseek',
            'anthropic': 'anthropic',
            'google': 'google',
            'zhipu': 'zhipu',
            'moonshot': 'moonshot',
            'baichuan': 'baichuan',
            'openrouter': 'openrouter',
            'groq': 'groq',
            'perplexity': 'perplexity',
            'mistral': 'mistral',
            'together': 'together',
            'dashscope': 'dashscope',
        };

        const runtimeProviderType = providerTypeMap[actualProviderType?.toLowerCase()] || actualProviderType?.toLowerCase();

        console.log(`[ProtoChat Connectivity Check] Provider: ${id} -> ${runtimeProviderType}, Model: ${model} -> ${actualModelId}`);

        // 使用 ModelRuntime 进行连通性测试
        const { ModelRuntime } = require('@lobechat/model-runtime');

        const runtime = ModelRuntime.initializeWithProvider(runtimeProviderType as any, {
            apiKey: keyVaults.apiKey,
            baseURL: keyVaults.proxyUrl || keyVaults.baseUrl,
        });

        // 进行简单的对话测试 - 使用解析后的原始模型ID
        const response = await runtime.chat({
            messages: [{ content: 'hello', role: 'user' }],
            model: actualModelId,
            stream: true,
        });

        if (response instanceof Response && !response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error(`[ProtoChat Connectivity Check] Response error:`, error);
            return res.status(response.status).json({
                error,
                message: '连通性测试失败',
                success: false,
            });
        }

        // 如果是流响应，读取一小块数据来验证连接
        if (response instanceof Response && response.body) {
            const reader = response.body.getReader();
            const { done } = await reader.read(); // 读取第一个 chunk
            reader.releaseLock(); // 释放锁
            if (done) {
                return res.status(500).json({
                    message: '连通性测试失败：未收到任何响应数据',
                    success: false,
                });
            }
        }

        console.log(`[ProtoChat Connectivity Check] Success for ${id}/${model}`);

        return res.json({
            message: '连通性测试通过',
            success: true,
        });
    } catch (error: any) {
        console.error('[ProtoChat Connectivity Check] Error:', error);

        // 提取更详细的错误信息 - 处理各种可能的错误格式
        let errorMessage = '未知错误';
        let errorType = 'UnknownError';

        if (typeof error === 'string') {
            errorMessage = error;
        } else if (error?.message) {
            errorMessage = error.message;
        } else if (error?.error?.message) {
            errorMessage = error.error.message;
            errorType = error.error.type || errorType;
        } else if (error?.cause?.message) {
            errorMessage = error.cause.message;
        } else if (error?.toString && typeof error.toString === 'function') {
            errorMessage = error.toString();
        } else {
            errorMessage = JSON.stringify(error);
        }

        errorType = error?.type || error?.name || error?.errorType || errorType;

        console.error(`[ProtoChat Connectivity Check] Parsed error: ${errorType} - ${errorMessage}`);

        // 检查是否是 API Key 相关错误
        const isInvalidAPIKey = errorMessage.includes('401') ||
                                errorMessage.includes('Unauthorized') ||
                                errorMessage.includes('Invalid') ||
                                errorType.includes('InvalidAPIKey') ||
                                errorType.includes('InvalidProviderAPIKey');

        if (isInvalidAPIKey) {
            return res.status(401).json({
                message: 'API Key 无效或已过期',
                success: false,
            });
        }

        // 检查是否是模型不存在/已下架的错误
        const is404Error = error?.error?.code === 404 ||
                            error?.statusCode === 404 ||
                            errorMessage.includes('404');
        const isModelNotFound = errorMessage.includes('No endpoints found') ||
                                errorMessage.includes('not found') ||
                                errorMessage.includes('model not found') ||
                                errorMessage.includes('does not exist');

        if (is404Error || isModelNotFound) {
            return res.status(404).json({
                message: `模型 "${model}" 不存在或已下架，请更新模型列表`,
                success: false,
            });
        }

        // 检查是否是不支持的供应商类型
        const isProviderNotSupported = errorMessage.includes('Cannot find runtime') ||
                                      errorMessage.includes('No provider found') ||
                                      error?.cause?.message?.includes('provider');

        if (isProviderNotSupported) {
            return res.status(400).json({
                message: `暂不支持该供应商 "${id}" 的连通性测试，请直接测试模型功能`,
                success: false,
            });
        }

        // 检查是否是网络连接错误
        const isNetworkError = errorMessage.includes('ECONNREFUSED') ||
                               errorMessage.includes('ENOTFOUND') ||
                               errorMessage.includes('fetch failed') ||
                               errorMessage.includes('Network error');

        if (isNetworkError) {
            return res.status(503).json({
                message: '网络连接失败，请检查 API 地址是否正确',
                success: false,
            });
        }

        // 检查是否是余额不足错误
        const isInsufficientBalance = errorMessage.includes('余额不足') ||
                                      errorMessage.includes('无可用') ||
                                      errorMessage.includes('insufficient') ||
                                      errorMessage.includes('balance') ||
                                      errorMessage.includes('quota') ||
                                      errorType.includes('InsufficientBalance') ||
                                      errorType.includes('QuotaExceeded');

        if (isInsufficientBalance) {
            return res.status(402).json({
                message: errorMessage,
                success: false,
            });
        }

        return res.status(500).json({
            message: errorMessage,
            error: errorType,
            success: false,
        });
    }
});

// DELETE /api/admin/protochat/ai-providers/:id
router.delete('/ai-providers/:id', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // 检查是否有关联的模型
        const relatedModels = await db
            .select()
            .from(protochatModels)
            .where(eq(protochatModels.originalProvider, id))
            .limit(1);

        if (relatedModels.length > 0) {
            return res.status(400).json({
                message: '该供应商下还有关联的模型，请先删除相关模型',
                success: false,
            });
        }

        await db.delete(protochatProviders).where(eq(protochatProviders.id, id));

        return res.json({
            message: '删除成功',
            success: true,
        });
    } catch (error) {
        console.error('Delete protochat ai provider error:', error);
        return res.status(500).json({
            message: '删除AI服务商失败',
            success: false,
        });
    }
});

// =============================================
// Providers 供应商管理 (原始API，保持向后兼容)
// =============================================

const upsertProviderSchema = z.object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(100),
    type: z.enum(['aggregator', 'direct']),
    enabled: z.boolean().default(true),
    priority: z.number().int().default(0),
    apiKey: z.string().optional(),
    baseUrl: z.string().max(500).optional(),
    apiEndpoint: z.string().max(500).optional(),
    pricingSyncStrategy: z.enum(['api', 'model_bank', 'manual']).optional(),
    pricingApiUrl: z.string().max(500).optional(),
    settings: z.record(z.any()).optional(),
});

// GET /api/admin/protochat/providers - 获取所有供应商
router.get('/providers', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const providers = await db
            .select()
            .from(protochatProviders)
            .orderBy(protochatProviders.priority);

        // 脱敏处理API Key
        const maskedProviders = providers.map((p) => ({
            ...p,
            apiKey: p.apiKey ? `${p.apiKey.slice(0, 8)}...${p.apiKey.slice(-4)}` : null,
        }));

        return res.json({
            data: maskedProviders,
            success: true,
        });
    } catch (error) {
        console.error('Get protochat providers error:', error);
        return res.status(500).json({
            message: '获取ProtoChat供应商列表失败',
            success: false,
        });
    }
});

// GET /api/admin/protochat/providers/:id - 获取单个供应商详情
router.get('/providers/:id', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const provider = await db
            .select()
            .from(protochatProviders)
            .where(eq(protochatProviders.id, id))
            .limit(1);

        if (!provider.length) {
            return res.status(404).json({
                message: '供应商不存在',
                success: false,
            });
        }

        return res.json({
            data: provider[0],
            success: true,
        });
    } catch (error) {
        console.error('Get protochat provider error:', error);
        return res.status(500).json({
            message: '获取ProtoChat供应商详情失败',
            success: false,
        });
    }
});

// POST /api/admin/protochat/providers - 创建或更新供应商
router.post('/providers', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const validation = upsertProviderSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.errors.map((err) => err.message),
                message: '输入数据无效',
                success: false,
            });
        }

        const { id, ...data } = validation.data;

        // 检查是否已存在
        const existing = await db
            .select()
            .from(protochatProviders)
            .where(eq(protochatProviders.id, id))
            .limit(1);

        if (existing.length > 0) {
            // 更新
            await db
                .update(protochatProviders)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(protochatProviders.id, id));
        } else {
            // 创建 - 自动生成别名
            const existingProviders = await db
                .select({ alias: protochatProviders.alias })
                .from(protochatProviders);
            const existingAliases = new Set(
                existingProviders.map(p => p.alias).filter(Boolean) as string[]
            );
            const alias = generateUniqueAlias(existingAliases);

            await db.insert(protochatProviders).values({
                id,
                ...data,
                alias,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        return res.json({
            message: existing.length > 0 ? '供应商更新成功' : '供应商创建成功',
            success: true,
        });
    } catch (error) {
        console.error('Upsert protochat provider error:', error);
        return res.status(500).json({
            message: '保存ProtoChat供应商失败',
            success: false,
        });
    }
});

// DELETE /api/admin/protochat/providers/:id - 删除供应商
router.delete('/providers/:id', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // 检查是否有关联的模型
        const relatedModels = await db
            .select()
            .from(protochatModels)
            .where(eq(protochatModels.originalProvider, id))
            .limit(1);

        if (relatedModels.length > 0) {
            return res.status(400).json({
                message: '该供应商下还有关联的模型，请先删除相关模型',
                success: false,
            });
        }

        await db.delete(protochatProviders).where(eq(protochatProviders.id, id));

        return res.json({
            message: '供应商删除成功',
            success: true,
        });
    } catch (error) {
        console.error('Delete protochat provider error:', error);
        return res.status(500).json({
            message: '删除ProtoChat供应商失败',
            success: false,
        });
    }
});

// =============================================
// Models 模型管理
// =============================================

const upsertModelSchema = z.object({
    id: z.string().min(1).max(200),
    originalId: z.string().min(1).max(200),
    originalProvider: z.string().min(1).max(64),
    displayName: z.string().min(1).max(200),
    type: z.enum(['chat', 'image', 'embedding']),
    enabled: z.boolean().default(false),
    capabilities: z.record(z.boolean()).optional(),
    contextTokens: z.number().int().positive().optional(),
    maxOutput: z.number().int().positive().optional(),
    parameters: z.record(z.any()).optional(),
    settings: z.record(z.any()).optional(),
});

// GET /api/admin/protochat/models - 获取所有模型
router.get('/models', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { provider, enabled, type, search } = req.query;

        let query = db.select().from(protochatModels);

        // 动态构建查询条件
        const conditions = [];
        if (provider) {
            conditions.push(eq(protochatModels.originalProvider, provider as string));
        }
        if (enabled !== undefined) {
            conditions.push(eq(protochatModels.enabled, enabled === 'true'));
        }
        if (type) {
            conditions.push(eq(protochatModels.type, type as string));
        }
        if (search) {
            conditions.push(like(protochatModels.displayName, `%${search}%`));
        }

        const models = conditions.length > 0
            ? await db.select().from(protochatModels).where(and(...conditions)).orderBy(protochatModels.displayName)
            : await db.select().from(protochatModels).orderBy(protochatModels.displayName);

        // 获取所有模型的定价信息
        const modelIds = models.map(m => m.id);
        let pricingData: any[] = [];
        if (modelIds.length > 0) {
            // 批量查询定价（安全方式）
            const pricingPromises = modelIds.map(id =>
                db.select().from(protochatModelPricing).where(eq(protochatModelPricing.modelId, id)).limit(1)
            );
            const pricingResults = await Promise.all(pricingPromises);
            pricingData = pricingResults.filter(r => r.length > 0).map(r => r[0]);
        }

        // 构建定价映射
        const pricingMap = new Map(pricingData.map(p => [p.modelId, p]));

        // 转换为前端期望的格式
        const formattedModels = models.map(model => {
            const pricing = pricingMap.get(model.id);
            const caps = model.capabilities as any || {};
            const settings = model.settings as any || {};
            const params = model.parameters as any || {};

            return {
                id: model.id,
                originalId: model.originalId,
                originalProvider: model.originalProvider,
                displayName: model.displayName,
                type: model.type,
                enabled: model.enabled,
                providerId: model.originalProvider, // 兼容旧字段名

                // 上下文窗口（兼容前端字段名）
                contextWindowTokens: model.contextTokens,
                maxOutput: model.maxOutput,

                // 能力（转换为前端期望的abilities格式）
                abilities: {
                    functionCall: caps.functionCall,
                    vision: caps.vision,
                    video: caps.video,
                    audio: caps.audio,
                    reasoning: caps.internalReasoning,
                    search: caps.webSearch,
                    structuredOutput: params.supported?.includes('response_format'),
                    streaming: caps.streaming,
                },

                // 定价信息（转换为前端期望的格式，使用成本价 USD/百万tokens）
                pricing: pricing ? {
                    currency: pricing.currency || 'USD',
                    units: [
                        {
                            name: 'textInput',
                            strategy: 'fixed' as const,
                            rate: parseFloat(pricing.costInputPrice),
                        },
                        {
                            name: 'textOutput',
                            strategy: 'fixed' as const,
                            rate: parseFloat(pricing.costOutputPrice),
                        },
                    ],
                } : null,

                // 发布时间
                releasedAt: settings.created
                    ? new Date(settings.created * 1000).toLocaleDateString('zh-CN')
                    : null,

                // 原始数据（用于调试）
                _raw: {
                    capabilities: model.capabilities,
                    parameters: model.parameters,
                    settings: model.settings,
                },
            };
        });

        return res.json({
            data: formattedModels,
            success: true,
        });
    } catch (error) {
        console.error('Get protochat models error:', error);
        return res.status(500).json({
            message: '获取ProtoChat模型列表失败',
            success: false,
        });
    }
});

// GET /api/admin/protochat/models/:id - 获取单个模型详情
router.get('/models/:id', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const model = await db
            .select()
            .from(protochatModels)
            .where(eq(protochatModels.id, id))
            .limit(1);

        if (!model.length) {
            return res.status(404).json({
                message: '模型不存在',
                success: false,
            });
        }

        // 同时获取定价信息
        const pricing = await db
            .select()
            .from(protochatModelPricing)
            .where(eq(protochatModelPricing.modelId, id))
            .limit(1);

        return res.json({
            data: {
                ...model[0],
                pricing: pricing[0] || null,
            },
            success: true,
        });
    } catch (error) {
        console.error('Get protochat model error:', error);
        return res.status(500).json({
            message: '获取ProtoChat模型详情失败',
            success: false,
        });
    }
});

// POST /api/admin/protochat/models - 创建或更新模型
router.post('/models', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const validation = upsertModelSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.errors.map((err) => err.message),
                message: '输入数据无效',
                success: false,
            });
        }

        const { id, ...data } = validation.data;

        // 验证供应商是否存在
        const provider = await db
            .select()
            .from(protochatProviders)
            .where(eq(protochatProviders.id, data.originalProvider))
            .limit(1);

        if (!provider.length) {
            return res.status(400).json({
                message: '关联的供应商不存在',
                success: false,
            });
        }

        // 检查是否已存在
        const existing = await db
            .select()
            .from(protochatModels)
            .where(eq(protochatModels.id, id))
            .limit(1);

        if (existing.length > 0) {
            // 更新
            await db
                .update(protochatModels)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(protochatModels.id, id));
        } else {
            // 创建
            await db.insert(protochatModels).values({
                id,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        return res.json({
            message: existing.length > 0 ? '模型更新成功' : '模型创建成功',
            success: true,
        });
    } catch (error) {
        console.error('Upsert protochat model error:', error);
        return res.status(500).json({
            message: '保存ProtoChat模型失败',
            success: false,
        });
    }
});

// PUT /api/admin/protochat/models/:id/toggle - 切换模型启用状态
router.put('/models/:id/toggle', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const model = await db
            .select()
            .from(protochatModels)
            .where(eq(protochatModels.id, id))
            .limit(1);

        if (!model.length) {
            return res.status(404).json({
                message: '模型不存在',
                success: false,
            });
        }

        await db
            .update(protochatModels)
            .set({
                enabled: !model[0].enabled,
                updatedAt: new Date(),
            })
            .where(eq(protochatModels.id, id));

        return res.json({
            data: { enabled: !model[0].enabled },
            message: `模型已${!model[0].enabled ? '启用' : '禁用'}`,
            success: true,
        });
    } catch (error) {
        console.error('Toggle protochat model error:', error);
        return res.status(500).json({
            message: '切换模型状态失败',
            success: false,
        });
    }
});

// DELETE /api/admin/protochat/models/:id - 删除模型
router.delete('/models/:id', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // 同时删除定价信息
        await db.delete(protochatModelPricing).where(eq(protochatModelPricing.modelId, id));
        await db.delete(protochatModels).where(eq(protochatModels.id, id));

        return res.json({
            message: '模型删除成功',
            success: true,
        });
    } catch (error) {
        console.error('Delete protochat model error:', error);
        return res.status(500).json({
            message: '删除ProtoChat模型失败',
            success: false,
        });
    }
});

// =============================================
// Pricing 定价管理
// =============================================

const upsertPricingSchema = z.object({
    modelId: z.string().min(1).max(200),
    costInputPrice: z.number().nonnegative(),
    costOutputPrice: z.number().nonnegative(),
    currency: z.string().max(10).default('USD'),
    priceSource: z.enum(['api', 'model_bank', 'manual']).optional(),
    isFree: z.boolean().default(false),
});

// GET /api/admin/protochat/pricing - 获取所有定价
router.get('/pricing', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const pricing = await db
            .select({
                id: protochatModelPricing.id,
                modelId: protochatModelPricing.modelId,
                costInputPrice: protochatModelPricing.costInputPrice,
                costOutputPrice: protochatModelPricing.costOutputPrice,
                currency: protochatModelPricing.currency,
                priceSource: protochatModelPricing.priceSource,
                isFree: protochatModelPricing.isFree,
                syncedAt: protochatModelPricing.syncedAt,
                modelDisplayName: protochatModels.displayName,
                modelEnabled: protochatModels.enabled,
            })
            .from(protochatModelPricing)
            .leftJoin(protochatModels, eq(protochatModelPricing.modelId, protochatModels.id))
            .orderBy(protochatModels.displayName);

        return res.json({
            data: pricing,
            success: true,
        });
    } catch (error) {
        console.error('Get protochat pricing error:', error);
        return res.status(500).json({
            message: '获取ProtoChat定价列表失败',
            success: false,
        });
    }
});

// POST /api/admin/protochat/pricing - 创建或更新定价
router.post('/pricing', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const validation = upsertPricingSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.errors.map((err) => err.message),
                message: '输入数据无效',
                success: false,
            });
        }

        const { modelId, ...data } = validation.data;

        // 验证模型是否存在
        const model = await db
            .select()
            .from(protochatModels)
            .where(eq(protochatModels.id, modelId))
            .limit(1);

        if (!model.length) {
            return res.status(400).json({
                message: '关联的模型不存在',
                success: false,
            });
        }

        // 检查是否已存在定价
        const existing = await db
            .select()
            .from(protochatModelPricing)
            .where(eq(protochatModelPricing.modelId, modelId))
            .limit(1);

        if (existing.length > 0) {
            // 更新
            await db
                .update(protochatModelPricing)
                .set({
                    costInputPrice: data.costInputPrice.toFixed(6),
                    costOutputPrice: data.costOutputPrice.toFixed(6),
                    currency: data.currency,
                    priceSource: data.priceSource,
                    isFree: data.isFree,
                    updatedAt: new Date(),
                })
                .where(eq(protochatModelPricing.modelId, modelId));
        } else {
            // 创建
            await db.insert(protochatModelPricing).values({
                modelId,
                costInputPrice: data.costInputPrice.toFixed(6),
                costOutputPrice: data.costOutputPrice.toFixed(6),
                currency: data.currency,
                priceSource: data.priceSource,
                isFree: data.isFree,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        return res.json({
            message: existing.length > 0 ? '定价更新成功' : '定价创建成功',
            success: true,
        });
    } catch (error) {
        console.error('Upsert protochat pricing error:', error);
        return res.status(500).json({
            message: '保存ProtoChat定价失败',
            success: false,
        });
    }
});

// =============================================
// Settings 全局设置
// =============================================

// GET /api/admin/protochat/settings - 获取全局设置
router.get('/settings', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const settings = await db.select().from(protochatSettings);

        // 转换为对象格式
        const settingsObj: Record<string, { value: number; description: string | null }> = {};
        settings.forEach((s) => {
            settingsObj[s.id] = {
                value: Number(s.value),
                description: s.description,
            };
        });

        return res.json({
            data: settingsObj,
            success: true,
        });
    } catch (error) {
        console.error('Get protochat settings error:', error);
        return res.status(500).json({
            message: '获取ProtoChat设置失败',
            success: false,
        });
    }
});

// POST /api/admin/protochat/settings - 更新设置
router.post('/settings', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id, value, description } = req.body;

        if (!id || value === undefined) {
            return res.status(400).json({
                message: '设置项ID和值是必填项',
                success: false,
            });
        }

        // 检查是否已存在
        const existing = await db
            .select()
            .from(protochatSettings)
            .where(eq(protochatSettings.id, id))
            .limit(1);

        if (existing.length > 0) {
            await db
                .update(protochatSettings)
                .set({
                    value: value.toString(),
                    description,
                    updatedAt: new Date(),
                })
                .where(eq(protochatSettings.id, id));
        } else {
            await db.insert(protochatSettings).values({
                id,
                value: value.toString(),
                description,
                updatedAt: new Date(),
            });
        }

        // 如果更新的是定价系数，需要批量更新所有模型的用户价
        if (id === 'pricing_multiplier') {
            const multiplier = parseFloat(value);
            console.log(`[ProtoChat Settings] Updating all model user prices with multiplier: ${multiplier}`);
            const result = await pricingService.updateAllUserPrices(multiplier);
            console.log(`[ProtoChat Settings] Updated ${result.updated} model pricings`);
        }

        return res.json({
            message: '设置更新成功',
            success: true,
        });
    } catch (error) {
        console.error('Update protochat settings error:', error);
        return res.status(500).json({
            message: '更新ProtoChat设置失败',
            success: false,
        });
    }
});

// =============================================
// Usage Logs 使用日志
// =============================================

// GET /api/admin/protochat/usage-logs - 获取使用日志
router.get('/usage-logs', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { userId, modelId, startDate, endDate, page = '1', pageSize = '20' } = req.query;

        const pageNum = parseInt(page as string, 10);
        const pageSizeNum = parseInt(pageSize as string, 10);
        const offset = (pageNum - 1) * pageSizeNum;

        const conditions = [];
        if (userId) {
            conditions.push(eq(protochatUsageLogs.userId, userId as string));
        }
        if (modelId) {
            conditions.push(eq(protochatUsageLogs.modelId, modelId as string));
        }
        if (startDate) {
            conditions.push(sql`${protochatUsageLogs.createdAt} >= ${new Date(startDate as string)}`);
        }
        if (endDate) {
            conditions.push(sql`${protochatUsageLogs.createdAt} <= ${new Date(endDate as string)}`);
        }

        const baseQuery = conditions.length > 0
            ? db.select().from(protochatUsageLogs).where(and(...conditions))
            : db.select().from(protochatUsageLogs);

        const logs = await db
            .select()
            .from(protochatUsageLogs)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(protochatUsageLogs.createdAt))
            .limit(pageSizeNum)
            .offset(offset);

        // 获取总数
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(protochatUsageLogs)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return res.json({
            data: logs,
            pagination: {
                page: pageNum,
                pageSize: pageSizeNum,
                total: Number(countResult[0].count),
            },
            success: true,
        });
    } catch (error) {
        console.error('Get protochat usage logs error:', error);
        return res.status(500).json({
            message: '获取ProtoChat使用日志失败',
            success: false,
        });
    }
});

// GET /api/admin/protochat/usage-stats - 获取使用统计
router.get('/usage-stats', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const conditions = [];
        if (startDate) {
            conditions.push(sql`${protochatUsageLogs.createdAt} >= ${new Date(startDate as string)}`);
        }
        if (endDate) {
            conditions.push(sql`${protochatUsageLogs.createdAt} <= ${new Date(endDate as string)}`);
        }

        // 总体统计
        const totalStats = await db
            .select({
                totalRequests: sql<number>`count(*)`,
                totalInputTokens: sql<number>`sum(${protochatUsageLogs.inputTokens})`,
                totalOutputTokens: sql<number>`sum(${protochatUsageLogs.outputTokens})`,
                totalCostPrice: sql<number>`sum(${protochatUsageLogs.costPrice})`,
                totalUserPrice: sql<number>`sum(${protochatUsageLogs.userPrice})`,
            })
            .from(protochatUsageLogs)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        // 按模型统计
        const modelStats = await db
            .select({
                modelId: protochatUsageLogs.modelId,
                requests: sql<number>`count(*)`,
                inputTokens: sql<number>`sum(${protochatUsageLogs.inputTokens})`,
                outputTokens: sql<number>`sum(${protochatUsageLogs.outputTokens})`,
                costPrice: sql<number>`sum(${protochatUsageLogs.costPrice})`,
                userPrice: sql<number>`sum(${protochatUsageLogs.userPrice})`,
            })
            .from(protochatUsageLogs)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .groupBy(protochatUsageLogs.modelId)
            .orderBy(desc(sql`count(*)`));

        // 按供应商统计
        const providerStats = await db
            .select({
                provider: protochatUsageLogs.originalProvider,
                requests: sql<number>`count(*)`,
                inputTokens: sql<number>`sum(${protochatUsageLogs.inputTokens})`,
                outputTokens: sql<number>`sum(${protochatUsageLogs.outputTokens})`,
                costPrice: sql<number>`sum(${protochatUsageLogs.costPrice})`,
                userPrice: sql<number>`sum(${protochatUsageLogs.userPrice})`,
            })
            .from(protochatUsageLogs)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .groupBy(protochatUsageLogs.originalProvider)
            .orderBy(desc(sql`count(*)`));

        return res.json({
            data: {
                total: totalStats[0],
                byModel: modelStats,
                byProvider: providerStats,
            },
            success: true,
        });
    } catch (error) {
        console.error('Get protochat usage stats error:', error);
        return res.status(500).json({
            message: '获取ProtoChat使用统计失败',
            success: false,
        });
    }
});

// =============================================
// Sync Models 模型同步
// =============================================

/**
 * 获取定价系数
 */
async function getPricingMultiplier(): Promise<number> {
    const result = await db
        .select()
        .from(protochatSettings)
        .where(eq(protochatSettings.id, 'pricing_multiplier'))
        .limit(1);

    return result.length > 0 ? parseFloat(result[0].value || '1.0') : 1.0;
}

/**
 * 将统一格式的模型数据同步到数据库
 */
async function syncModelToDatabase(
    modelData: UnifiedModelData,
    providerId: string,
    enabledModelIds?: Set<string>
): Promise<void> {
    // 保留现有模型的 enabled 状态
    // 如果提供了 enabledModelIds（从删除前保存），使用它
    // 否则查询数据库（兼容旧逻辑）
    let enabled = false;
    if (enabledModelIds) {
        enabled = enabledModelIds.has(modelData.id);
    } else {
        const existing = await db
            .select()
            .from(protochatModels)
            .where(eq(protochatModels.id, modelData.id))
            .limit(1);
        enabled = existing.length > 0 ? existing[0].enabled : false;
    }

    const modelRecord = {
        id: modelData.id,
        originalId: modelData.originalId,
        originalProvider: providerId,
        displayName: modelData.displayName,
        type: modelData.type,
        enabled,
        capabilities: modelData.capabilities,
        contextTokens: modelData.contextTokens,
        maxOutput: modelData.maxOutput,
        parameters: modelData.parameters,
        settings: modelData.settings,
        updatedAt: new Date(),
    };

    // Upsert 模型
    await db
        .insert(protochatModels)
        .values({ ...modelRecord, createdAt: new Date() })
        .onConflictDoUpdate({
            target: protochatModels.id,
            set: modelRecord,
        });

    // ProtoChat子供应商同步：存储美元价格（USD/百万tokens）
    // 积分价格由模型价格页面同步时计算
    const pricingRecord = {
        modelId: modelData.id,
        costInputPrice: modelData.pricing.inputPrice.toFixed(4),
        costOutputPrice: modelData.pricing.outputPrice.toFixed(4),
        currency: 'USD',
        priceSource: 'api',
        isFree: modelData.pricing.isFree,
        syncedAt: new Date(),
        updatedAt: new Date(),
    };

    // Upsert 定价
    await db
        .insert(protochatModelPricing)
        .values({ ...pricingRecord, createdAt: new Date() })
        .onConflictDoUpdate({
            target: protochatModelPricing.modelId,
            set: pricingRecord,
        });
}

/**
 * 从 API 同步模型
 */
async function syncFromAPI(
    providerId: string,
    providerData: any,
    res: Response
): Promise<any> {
    try {
        const apiUrl = providerData.pricingApiUrl;
        const providerAlias = providerData.alias;

        if (!apiUrl) {
            throw new Error('未配置 API URL');
        }

        if (!providerAlias) {
            throw new Error(`供应商 ${providerId} 未配置别名（alias），请先设置别名`);
        }

        console.log(`[${providerId}] 开始从 API 同步: ${apiUrl}`);

        // 获取 API Key（如果需要）
        let apiKey: string | undefined;
        if (providerData.apiKey) {
            try {
                const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
                const result = await gateKeeper.decrypt(providerData.apiKey);
                if (result.wasAuthentic) {
                    const keyVaults = JSON.parse(result.plaintext);
                    apiKey = keyVaults.apiKey;
                }
            } catch (e) {
                console.warn(`[${providerId}] 无法解密 API Key，尝试无认证请求`);
            }
        }

        // 使用适配器工厂获取并转换模型数据
        const unifiedModels = await AdapterFactory.fetchAndAdapt(apiUrl, providerId, providerAlias, apiKey);

        console.log(`[${providerId}] 获取到 ${unifiedModels.length} 个模型`);

        // ✅ 先保存已启用模型的状态，然后删除该供应商的所有旧模型和定价，避免累加
        console.log(`[${providerId}] 保存已启用模型状态并删除旧数据...`);

        // 先获取要删除的模型 ID 列表，并保存 enabled 状态
        // 注意：只处理 chat 类型的模型，保留手动添加的 image/embedding 等类型模型
        const oldModels = await db.select({ id: protochatModels.id, enabled: protochatModels.enabled })
            .from(protochatModels)
            .where(and(eq(protochatModels.originalProvider, providerId), eq(protochatModels.type, 'chat')));

        // 保存已启用的模型 ID（用于稍后恢复状态）
        const enabledModelIds = new Set(oldModels.filter(m => m.enabled).map(m => m.id));
        console.log(`[${providerId}] 保存了 ${enabledModelIds.size} 个已启用模型的状态`);

        // 删除定价记录
        if (oldModels.length > 0) {
            const modelIds = oldModels.map(m => m.id);
            for (const modelId of modelIds) {
                await db.delete(protochatModelPricing).where(eq(protochatModelPricing.modelId, modelId));
            }
        }

        // 删除 chat 类型的模型记录（保留 image/embedding 等手动添加的模型）
        await db.delete(protochatModels).where(and(eq(protochatModels.originalProvider, providerId), eq(protochatModels.type, 'chat')));

        // 批量同步到数据库，传递 enabledModelIds 以恢复之前的启用状态
        let syncedCount = 0;
        for (const model of unifiedModels) {
            await syncModelToDatabase(model, providerId, enabledModelIds);
            syncedCount++;
        }

        console.log(`[${providerId}] API 同步完成: ${syncedCount} 个模型`);

        return res.json({
            data: {
                providerId,
                providerName: providerData.name,
                syncedModels: syncedCount,
                syncedPricing: syncedCount,
                source: 'api',
            },
            message: `成功从 API 同步 ${syncedCount} 个模型`,
            success: true,
        });
    } catch (error: any) {
        console.error(`[${providerId}] API 同步失败:`, error);
        throw error;
    }
}

/**
 * 从 model-bank 同步模型
 */
async function syncFromModelBank(
    providerId: string,
    providerData: any,
    res: Response
): Promise<any> {
    const providerAlias = providerData.alias;

    if (!providerAlias) {
        throw new Error(`供应商 ${providerId} 未配置别名（alias），请先设置别名`);
    }

    console.log(`[${providerId}] 开始从 model-bank 同步 (alias: ${providerAlias})`);

    // 和前端一样：根据 providerId 过滤
    const modelList = LOBE_DEFAULT_MODEL_LIST.filter((m: any) => m.providerId === providerId);

    console.log(`[${providerId}] 从 LOBE_DEFAULT_MODEL_LIST 过滤到 ${modelList.length} 个模型`);

    if (modelList.length === 0) {
        return res.status(400).json({
            message: `供应商 "${providerId}" 在 Model-Bank 中没有可用模型`,
            success: false,
        });
    }

    // ✅ 先保存已启用模型的状态，然后删除该供应商的所有旧模型和定价，避免累加
    console.log(`[${providerId}] 保存已启用模型状态并删除旧数据...`);

    // 先获取要删除的模型 ID 列表，并保存 enabled 状态
    // 注意：只处理 chat 类型的模型，保留手动添加的 image/embedding 等类型模型
    const oldModels = await db.select({ id: protochatModels.id, enabled: protochatModels.enabled })
        .from(protochatModels)
        .where(and(eq(protochatModels.originalProvider, providerId), eq(protochatModels.type, 'chat')));

    // 保存已启用的模型 ID（用于稍后恢复状态）
    const enabledModelIds = new Set(oldModels.filter(m => m.enabled).map(m => m.id));
    console.log(`[${providerId}] 保存了 ${enabledModelIds.size} 个已启用模型的状态`);

    // 删除定价记录
    if (oldModels.length > 0) {
        const modelIds = oldModels.map(m => m.id);
        for (const modelId of modelIds) {
            await db.delete(protochatModelPricing).where(eq(protochatModelPricing.modelId, modelId));
        }
    }

    // 删除 chat 类型的模型记录（保留 image/embedding 等手动添加的模型）
    await db.delete(protochatModels).where(and(eq(protochatModels.originalProvider, providerId), eq(protochatModels.type, 'chat')));

    let syncedCount = 0;
    let pricingCount = 0;

    for (const model of modelList) {
        // 构建 ProtoChat 模型 ID
        // 1. 先清理模型 ID (去掉 providerId/ 前缀)
        let cleanModelId = model.id;
        if (model.id.startsWith(`${providerId}/`)) {
            cleanModelId = model.id.substring(providerId.length + 1);
        }
        // 2. 使用统一格式: protochat::{alias}::{modelId}
        const protochatModelId = `protochat::${providerAlias}::${cleanModelId}`;

        // 插入或更新模型，恢复之前的 enabled 状态
        const modelData = {
            id: protochatModelId,
            originalId: `${providerId}::${model.id}`,
            originalProvider: providerId,
            displayName: model.displayName || model.id,
            type: model.type || 'chat',
            // 优先使用保存的 enabled 状态，其次使用 model-bank 的默认值
            enabled: enabledModelIds.has(protochatModelId)
                ? true
                : (model.enabled !== undefined ? model.enabled : false),
            capabilities: model.abilities || {},
            contextTokens: model.contextWindowTokens || null,
            maxOutput: model.maxOutput || null,
            parameters: model.parameters || {},
            settings: {},
            updatedAt: new Date(),
        };

        // Upsert model
        await db
            .insert(protochatModels)
            .values({ ...modelData, createdAt: new Date() })
            .onConflictDoUpdate({
                target: protochatModels.id,
                set: modelData,
            });

        syncedCount++;

        // 处理定价
        if (model.pricing && model.pricing.units) {
            const inputUnit = model.pricing.units.find((u: any) => u.name === 'textInput');
            const outputUnit = model.pricing.units.find((u: any) => u.name === 'textOutput');

            if (inputUnit && outputUnit) {
                const getRate = (unit: any) => {
                    if (unit.strategy === 'fixed') return unit.rate;
                    if (unit.strategy === 'lookup' && unit.lookup?.prices) {
                        const prices = Object.values(unit.lookup.prices) as number[];
                        return prices[0] || 0;
                    }
                    return 0;
                };

                // 直接使用 model-bank 中的原始价格（单位已经是 USD/百万tokens）
                const costInputPrice = getRate(inputUnit);
                const costOutputPrice = getRate(outputUnit);

                const pricingData = {
                    modelId: protochatModelId,
                    costInputPrice: costInputPrice.toFixed(4),
                    costOutputPrice: costOutputPrice.toFixed(4),
                    currency: 'USD',
                    priceSource: 'model_bank',
                    isFree: false,
                    syncedAt: new Date(),
                    updatedAt: new Date(),
                };

                // Upsert pricing
                await db
                    .insert(protochatModelPricing)
                    .values({ ...pricingData, createdAt: new Date() })
                    .onConflictDoUpdate({
                        target: protochatModelPricing.modelId,
                        set: pricingData,
                    });

                pricingCount++;
            }
        }
    }

    console.log(`[${providerId}] model-bank 同步完成: ${syncedCount} 个模型`);

    return res.json({
        data: {
            providerId,
            providerName: providerData.name,
            syncedModels: syncedCount,
            syncedPricing: pricingCount,
            source: 'model_bank',
        },
        message: `成功从 model-bank 同步 ${syncedCount} 个模型，${pricingCount} 条定价信息`,
        success: true,
    });
}

// POST /api/admin/protochat/providers/:id/test-api - 测试 API URL
router.post('/providers/:id/test-api', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id: providerId } = req.params;
        const { apiUrl: testApiUrl } = req.body;

        if (!testApiUrl || !testApiUrl.trim()) {
            return res.status(400).json({
                message: '请提供要测试的 API URL',
                success: false,
            });
        }

        console.log(`[${providerId}] 测试 API: ${testApiUrl}`);

        // 获取供应商信息（用于获取 API Key）
        const provider = await db
            .select()
            .from(protochatProviders)
            .where(eq(protochatProviders.id, providerId))
            .limit(1);

        let apiKey: string | undefined;
        if (provider.length > 0 && provider[0].apiKey) {
            try {
                const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
                const result = await gateKeeper.decrypt(provider[0].apiKey);
                if (result.wasAuthentic) {
                    const keyVaults = JSON.parse(result.plaintext);
                    apiKey = keyVaults.apiKey;
                }
            } catch (e) {
                console.warn(`[${providerId}] 无法解密 API Key，尝试无认证请求`);
            }
        }

        // 尝试获取数据
        const startTime = Date.now();
        const unifiedModels = await AdapterFactory.fetchAndAdapt(testApiUrl, providerId, providerId, apiKey);
        const duration = Date.now() - startTime;

        // 获取适配器类型
        const Adapter = AdapterFactory.getAdapter(testApiUrl);
        const adapterName = Adapter.name;

        // 统计信息
        const modelTypes = unifiedModels.reduce((acc, model) => {
            acc[model.type] = (acc[model.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const freeModels = unifiedModels.filter(m => m.pricing.isFree).length;
        const paidModels = unifiedModels.length - freeModels;

        // 示例模型（前3个）
        const sampleModels = unifiedModels.slice(0, 3).map(m => ({
            id: m.id,
            displayName: m.displayName,
            type: m.type,
            inputPrice: m.pricing.inputPrice.toFixed(4),
            outputPrice: m.pricing.outputPrice.toFixed(4),
            isFree: m.pricing.isFree,
        }));

        return res.json({
            success: true,
            message: 'API 测试成功',
            data: {
                apiUrl: testApiUrl,
                adapter: adapterName,
                totalModels: unifiedModels.length,
                modelTypes,
                freeModels,
                paidModels,
                duration: `${duration}ms`,
                sampleModels,
            },
        });
    } catch (error: any) {
        console.error('Test API error:', error);
        return res.status(500).json({
            success: false,
            message: `API 测试失败: ${error.message}`,
            error: error.message,
        });
    }
});

// POST /api/admin/protochat/providers/:id/sync - 统一模型同步端点
router.post('/providers/:id/sync', authenticateToken, requirePermission('system.admin'), async (req, res) => {
    try {
        const { id: providerId } = req.params;

        // 1. 获取供应商信息
        const provider = await db
            .select()
            .from(protochatProviders)
            .where(eq(protochatProviders.id, providerId))
            .limit(1);

        if (!provider.length) {
            return res.status(404).json({
                message: '供应商不存在',
                success: false,
            });
        }

        const providerData = provider[0];
        const apiUrl = providerData.pricingApiUrl;

        let result: any;

        // 核心逻辑：有 API URL 就尝试 API，失败则降级到 model-bank
        if (apiUrl && apiUrl.trim()) {
            try {
                result = await syncFromAPI(providerId, providerData, res);
            } catch (apiError: any) {
                console.warn(`[${providerId}] API 同步失败，尝试降级到 model-bank:`, apiError.message);
                // 降级到 model-bank
                result = await syncFromModelBank(providerId, providerData, res);
            }
        } else {
            // 没有 API URL，直接使用 model-bank
            result = await syncFromModelBank(providerId, providerData, res);
        }

        // 更新供应商的最后同步时间
        await db
            .update(protochatProviders)
            .set({
                settings: {
                    ...(providerData.settings as any || {}),
                    lastSyncedAt: new Date().toISOString(),
                },
                updatedAt: new Date(),
            })
            .where(eq(protochatProviders.id, providerId));

        return result;
    } catch (error) {
        console.error('Sync protochat models error:', error);
        return res.status(500).json({
            message: '同步模型失败: ' + (error as Error).message,
            success: false,
        });
    }
});

export default router;
