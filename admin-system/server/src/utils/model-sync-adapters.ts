/**
 * 模型同步适配器
 * 用于将不同供应商的 API 响应格式转换为统一的数据结构
 */

export interface UnifiedModelData {
    id: string;
    originalId: string;
    displayName: string;
    type: 'chat' | 'image' | 'embedding';
    capabilities: any;
    contextTokens: number | null;
    maxOutput: number | null;
    parameters: any;
    pricing: {
        inputPrice: number;  // USD per million tokens
        outputPrice: number; // USD per million tokens
        isFree: boolean;
        currency: string;
    };
    settings: any;
}

/**
 * OpenRouter API 适配器
 */
export class OpenRouterAdapter {
    /**
     * 从 OpenRouter API 获取模型列表
     */
    static async fetchModels(apiUrl: string, apiKey?: string): Promise<any[]> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
            throw new Error(`OpenRouter API 返回错误: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();
        return data.data || [];
    }

    /**
     * 推断模型类型
     */
    private static inferModelType(architecture: any): 'chat' | 'image' | 'embedding' {
        const modality = architecture?.modality || '';

        if (modality.includes('->image')) return 'image';
        if (modality.includes('embedding')) return 'embedding';
        return 'chat';
    }

    /**
     * 检测是否为推理模型
     * 通过 supported_parameters、模型ID、名称和API字段综合判断
     */
    private static hasReasoningAbility(apiModel: any, pricing: any): boolean {
        // 1. 优先检查 supported_parameters 中是否包含 reasoning 相关参数
        const supportedParams = apiModel.supported_parameters || [];
        if (supportedParams.includes('reasoning') || supportedParams.includes('include_reasoning')) {
            return true;
        }

        // 2. 检查 pricing.internal_reasoning 字段
        if (pricing.internal_reasoning !== undefined && pricing.internal_reasoning !== '0') {
            return true;
        }

        // 3. 检查模型ID和名称中的关键词
        const id = (apiModel.id || '').toLowerCase();
        const name = (apiModel.name || '').toLowerCase();
        const reasoningKeywords = ['r1', 'reasoner', 'reasoning', 'think', 'o1', 'o3'];

        for (const keyword of reasoningKeywords) {
            if (id.includes(keyword) || name.includes(keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 清理模型 ID（去除供应商前缀）
     */
    private static cleanModelId(id: string): string {
        // "openai/gpt-5.2" -> "gpt-5.2"
        const parts = id.split('/');
        return parts.length > 1 ? parts[1] : id;
    }

    /**
     * 转换为统一格式
     * @param apiModel API返回的原始模型数据
     * @param providerId 供应商ID，如 'openrouter'
     * @param providerAlias 供应商别名，用于生成模型ID，如 'a1'
     */
    static adaptModel(apiModel: any, providerId: string, providerAlias: string): UnifiedModelData {
        const cleanId = this.cleanModelId(apiModel.id);
        const architecture = apiModel.architecture || {};
        const pricing = apiModel.pricing || {};
        const topProvider = apiModel.top_provider || {};

        // 价格转换：USD/token -> USD/million tokens
        // OpenRouter返回的是每token的美元价格（如0.000005）
        // 确保价格不为负数（某些模型可能返回异常值）
        const rawInputPrice = parseFloat(pricing.prompt || '0');
        const rawOutputPrice = parseFloat(pricing.completion || '0');
        const inputPrice = (rawInputPrice >= 0 ? rawInputPrice : 0) * 1_000_000;
        const outputPrice = (rawOutputPrice >= 0 ? rawOutputPrice : 0) * 1_000_000;
        const requestPrice = parseFloat(pricing.request || '0');
        const imagePrice = parseFloat(pricing.image || '0');

        // 上下文长度优先级：顶层 > top_provider > architecture
        const contextLength = apiModel.context_length
            || topProvider.context_length
            || architecture.context_length
            || null;

        // 最大输出长度
        const maxOutput = topProvider.max_completion_tokens
            || architecture.max_completion_tokens
            || null;

        // 解析能力
        const supportedParams = apiModel.supported_parameters || [];
        const inputModalities = architecture.input_modalities || [];
        const outputModalities = architecture.output_modalities || [];

        // 处理显示名称：去除 "Provider: " 前缀，去除多词括号后缀
        let displayName = apiModel.name || apiModel.id;
        const colonIndex = displayName.indexOf(':');
        if (colonIndex !== -1) {
            const prefix = displayName.slice(0, colonIndex).trim();
            const suffix = displayName.slice(colonIndex + 1).trim();
            const isDeepSeekPrefix = prefix.toLowerCase() === 'deepseek';
            const suffixHasDeepSeek = suffix.toLowerCase().includes('deepseek');
            if (isDeepSeekPrefix && !suffixHasDeepSeek) {
                // keep full name for DeepSeek
            } else {
                displayName = suffix;
            }
        }
        // Strip trailing multi-word parentheticals, e.g. "Nano Banana Pro (Gemini 3 Pro Image Preview)" → "Nano Banana Pro"
        // Single-word qualifiers like (free), (thinking) are kept.
        displayName = displayName.replace(/\s*\([^)]*\s[^)]*\)\s*$/, '').trim();

        return {
            id: `protochat::${providerAlias}::${cleanId}`,
            originalId: `${providerId}::${apiModel.id}`,
            displayName,
            type: this.inferModelType(architecture),
            capabilities: {
                // 模态信息
                modality: architecture.modality,
                inputModalities: inputModalities,
                outputModalities: architecture.output_modalities || [],
                tokenizer: architecture.tokenizer,
                instructType: architecture.instruct_type,

                // 功能能力
                functionCall: supportedParams.includes('tools') || supportedParams.includes('functions'),
                vision: inputModalities.includes('image'),
                audioInput: inputModalities.includes('audio'),
                audioOutput: outputModalities.includes('audio'),
                imageOutput: outputModalities.includes('image'),
                files: inputModalities.includes('file'),
                video: inputModalities.includes('video'),
                streaming: supportedParams.includes('stream'),

                // 高级功能
                webSearch: pricing.web_search !== undefined && pricing.web_search !== '0',
                internalReasoning: this.hasReasoningAbility(apiModel, pricing),
                cacheSupport: pricing.input_cache_read !== undefined || pricing.input_cache_write !== undefined,
            },
            contextTokens: contextLength,
            maxOutput: maxOutput,
            parameters: {
                supported: supportedParams,
                defaults: apiModel.default_parameters || {},
            },
            pricing: {
                inputPrice,
                outputPrice,
                isFree: inputPrice === 0 && outputPrice === 0 && requestPrice === 0,
                currency: 'USD',
            },
            settings: {
                description: apiModel.description,
                created: apiModel.created, // Unix timestamp
                canonicalSlug: apiModel.canonical_slug,
                apiSource: 'openrouter',
                // 额外定价信息
                extraPricing: {
                    requestPrice,
                    imagePrice,
                    audioPrice: parseFloat(pricing.audio || '0'),
                    webSearchPrice: parseFloat(pricing.web_search || '0'),
                    internalReasoningPrice: parseFloat(pricing.internal_reasoning || '0'),
                },
            },
        };
    }

    /**
     * 批量转换
     * @param apiModels API返回的原始模型数据数组
     * @param providerId 供应商ID，如 'openrouter'
     * @param providerAlias 供应商别名，用于生成模型ID，如 'a1'
     */
    static adaptModels(apiModels: any[], providerId: string, providerAlias: string): UnifiedModelData[] {
        return apiModels.map(model => this.adaptModel(model, providerId, providerAlias));
    }
}

/**
 * 通用 API 适配器
 * 用于尝试自动识别格式
 */
export class GenericAdapter {
    static async fetchModels(apiUrl: string, apiKey?: string): Promise<any[]> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
            throw new Error(`API 返回错误: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();

        // 尝试识别数据结构
        if (data.data && Array.isArray(data.data)) {
            return data.data;
        }

        if (Array.isArray(data)) {
            return data;
        }

        if (data.models && Array.isArray(data.models)) {
            return data.models;
        }

        throw new Error('无法识别 API 响应格式');
    }

    static adaptModel(apiModel: any, providerId: string, providerAlias: string): UnifiedModelData {
        // 尝试通用映射
        const id = apiModel.id || apiModel.model_id || apiModel.name;
        const name = apiModel.name || apiModel.display_name || id;

        return {
            id: `protochat::${providerAlias}::${id}`,
            originalId: `${providerId}::${id}`,
            displayName: name,
            type: 'chat',
            capabilities: apiModel.capabilities || apiModel.abilities || {},
            contextTokens: apiModel.context_length || apiModel.contextWindowTokens || null,
            maxOutput: apiModel.max_output || apiModel.maxOutput || null,
            parameters: apiModel.parameters || apiModel.supported_parameters || [],
            pricing: {
                inputPrice: (apiModel.input_price || 0),
                outputPrice: (apiModel.output_price || 0),
                isFree: false,
                currency: apiModel.currency || 'USD',
            },
            settings: {
                description: apiModel.description,
            },
        };
    }
}

/**
 * 适配器工厂
 * 根据 URL 自动选择合适的适配器
 */
export class AdapterFactory {
    static getAdapter(apiUrl: string): typeof OpenRouterAdapter | typeof GenericAdapter {
        if (apiUrl.includes('openrouter.ai')) {
            return OpenRouterAdapter;
        }

        // 未来可以添加更多适配器
        // if (apiUrl.includes('deepseek.com')) {
        //     return DeepSeekAdapter;
        // }

        // 默认使用通用适配器
        return GenericAdapter;
    }

    static async fetchAndAdapt(
        apiUrl: string,
        providerId: string,
        providerAlias: string,
        apiKey?: string
    ): Promise<UnifiedModelData[]> {
        const Adapter = this.getAdapter(apiUrl);
        const rawModels = await Adapter.fetchModels(apiUrl, apiKey);

        if (Adapter === OpenRouterAdapter) {
            return OpenRouterAdapter.adaptModels(rawModels, providerId, providerAlias);
        }

        return rawModels.map(model => GenericAdapter.adaptModel(model, providerId, providerAlias));
    }
}
