import type {
  LobeChatDatabase} from '@lobechat/database';
import {
  modelPricings,
  protochatModels,
  protochatProviders,
  protochatSettings,
  protochatUsageLogs,
} from '@lobechat/database';
import { and, eq, like } from 'drizzle-orm';

import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

/**
 * ProtoChat模型映射信息
 */
export interface ProtoChatModelMapping {
  /** 底层供应商的API Key */
  apiKey: string;
  /** 底层供应商的Base URL */
  baseUrl: string;
  /** 原始模型ID，如 'openrouter::openai/gpt-4o' */
  originalId: string;
  /** 原始供应商ID，如 'openrouter' */
  originalProvider: string;
  /** 模型类型: 'chat' | 'image' | 'embedding' */
  type: string;
}

/**
 * ProtoChat定价信息
 */
export interface ProtoChatPricing {
  /** 是否免费 */
  isFree: boolean;
  /** 用户价格 - 输入（积分/百万tokens） */
  userInputPrice: number;
  /** 用户价格 - 输出（积分/百万tokens） */
  userOutputPrice: number;
}

/**
 * ProtoChat 服务
 *
 * 提供模型映射、定价查询、使用日志等功能
 */
export class ProtoChatService {
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  /**
   * 获取模型映射信息
   * @param modelId ProtoChat模型ID，支持完整格式 'protochat::a1::gpt-4o' 或简短格式 'gpt-4o'
   */
  async getModelMapping(
    modelId: string,
    options: { ignoreModelEnabled?: boolean } = {},
  ): Promise<ProtoChatModelMapping> {
    // 首先尝试精确匹配
    let model = await this.db
      .select()
      .from(protochatModels)
      .where(eq(protochatModels.id, modelId))
      .limit(1);

    // 如果精确匹配失败，尝试模糊匹配（支持旧格式的模型ID）
    if (!model.length && !modelId.startsWith('protochat::')) {
      // 尝试匹配以该模型ID结尾的完整ID（如 'protochat::a1::gemini-2.5-flash' 匹配 'gemini-2.5-flash'）
      model = await this.db
        .select()
        .from(protochatModels)
        .where(
          options.ignoreModelEnabled
            ? like(protochatModels.id, `%::${modelId}`)
            : and(like(protochatModels.id, `%::${modelId}`), eq(protochatModels.enabled, true)),
        )
        .limit(1);
    }

    if (!model.length) {
      throw new Error(`ProtoChat model not found: ${modelId}`);
    }

    const modelData = model[0];

    if (!options.ignoreModelEnabled && !modelData.enabled) {
      throw new Error(`ProtoChat model is disabled: ${modelId}`);
    }

    // 查询供应商
    const provider = await this.db
      .select()
      .from(protochatProviders)
      .where(eq(protochatProviders.id, modelData.originalProvider))
      .limit(1);

    if (!provider.length) {
      throw new Error(`ProtoChat provider not found: ${modelData.originalProvider}`);
    }

    const providerData = provider[0];

    if (!providerData.enabled) {
      throw new Error(`ProtoChat provider is disabled: ${modelData.originalProvider}`);
    }

    // 解密API Key
    let keyVaults: any = {};

    if (providerData.apiKey) {
      try {
        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
        const { wasAuthentic, plaintext } = await gateKeeper.decrypt(providerData.apiKey);

        if (wasAuthentic && plaintext) {
          try {
            keyVaults = JSON.parse(plaintext);
          } catch (e) {
            console.error(
              `[ProtoChat] Failed to parse keyVaults JSON for ${modelData.originalProvider}:`,
              e,
            );
          }
        } else if (!wasAuthentic) {
          console.error(
            `[ProtoChat] Decryption authentication failed for ${modelData.originalProvider}. This usually means the encryption key is different from the one used to encrypt.`,
          );
        }
      } catch (error) {
        console.error(
          `[ProtoChat] Error during decryption for ${modelData.originalProvider}:`,
          error,
        );
      }
    }

    const apiKey = keyVaults.apiKey || '';
    let baseUrl = providerData.baseUrl || '';

    // 优先使用 keyVaults 中的 baseUrl 或 proxyUrl
    if (keyVaults.baseURL) {
      baseUrl = keyVaults.baseURL;
    } else if (keyVaults.proxyUrl) {
      baseUrl = keyVaults.proxyUrl;
    } else if (keyVaults.baseUrl) {
      baseUrl = keyVaults.baseUrl;
    }

    if (!apiKey) {
      throw new Error(`No API key found for provider ${modelData.originalProvider}`);
    }

    return {
      apiKey,
      baseUrl,
      originalId: modelData.originalId,
      originalProvider: modelData.originalProvider,
      type: modelData.type,
    };
  }

  /**
   * 获取 Protochat 子供应商（protochat_providers）的解密凭证。
   * 用于记忆提取等后台任务直接复用管理员在子供应商中配置的 API Key，
   * 无需在 .env 中重复配置。
   * @returns { apiKey, baseURL } 或 null（供应商不存在/未启用/无 key）
   */
  async getSubProviderCredentials(
    providerId: string,
  ): Promise<{ apiKey: string; baseURL: string } | null> {
    const rows = await this.db
      .select()
      .from(protochatProviders)
      .where(eq(protochatProviders.id, providerId))
      .limit(1);

    if (!rows.length) {
      return null;
    }

    const providerData = rows[0];
    let keyVaults: Record<string, string> = {};

    if (providerData.apiKey) {
      try {
        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
        const { wasAuthentic, plaintext } = await gateKeeper.decrypt(providerData.apiKey);
        if (wasAuthentic && plaintext) keyVaults = JSON.parse(plaintext);
      } catch (e) {
        console.error(`[ProtoChat] getSubProviderCredentials: decryption failed for ${providerId}:`, e);
      }
    }

    if (!keyVaults.apiKey) {
      console.warn(`[ProtoChat] getSubProviderCredentials: no apiKey found in keyVaults for ${providerId}`);
      return null;
    }

    const baseURL =
      keyVaults.baseURL || keyVaults.proxyUrl || keyVaults.baseUrl || providerData.baseUrl || '';

    return { apiKey: keyVaults.apiKey, baseURL };
  }

  /**
   * 转换模型ID
   * 从 'openrouter::openai/gpt-4o' 提取 'openai/gpt-4o'
   */
  convertModelId(originalId: string): string {
    const parts = originalId.split('::');
    return parts.at(-1) || originalId;
  }

  /**
   * 获取模型定价（从 model_pricings 表读取已计算好的积分价格）
   * @param modelId ProtoChat模型ID
   */
  async getModelPricing(modelId: string): Promise<ProtoChatPricing | null> {
    const pricing = await this.db
      .select()
      .from(modelPricings)
      .where(
        and(
          eq(modelPricings.model, modelId),
          eq(modelPricings.provider, 'protochat'),
        ),
      )
      .limit(1);

    if (!pricing.length) {
      return null;
    }

    const pricingData = pricing[0];
    const userInputPrice = Number(pricingData.userInputPrice);
    const userOutputPrice = Number(pricingData.userOutputPrice);

    return {
      isFree: userInputPrice === 0 && userOutputPrice === 0,
      userInputPrice,
      userOutputPrice,
    };
  }

  /**
   * 获取定价系数
   */
  async getPricingMultiplier(): Promise<number> {
    const setting = await this.db
      .select()
      .from(protochatSettings)
      .where(eq(protochatSettings.id, 'pricing_multiplier'))
      .limit(1);

    if (!setting.length) {
      return 1; // 默认系数
    }

    return Number(setting[0].value);
  }

  /**
   * 计算使用费用
   * @param modelId ProtoChat模型ID
   * @param inputTokens 输入token数
   * @param outputTokens 输出token数
   * @returns 总费用（积分），如果是免费模型返回0
   */
  async calculateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<{ cost: number; isFree: boolean }> {
    const pricing = await this.getModelPricing(modelId);

    if (!pricing) {
      console.error(`[ProtoChat] Pricing not found for model: ${modelId}`);
      return { cost: 0, isFree: false };
    }

    if (pricing.isFree) {
      return { cost: 0, isFree: true };
    }

    // 计算费用：(tokens / 1,000,000) * price_per_million
    const inputCost = (inputTokens / 1_000_000) * pricing.userInputPrice;
    const outputCost = (outputTokens / 1_000_000) * pricing.userOutputPrice;
    const totalCost = Math.ceil(inputCost + outputCost);

    return { cost: totalCost, isFree: false };
  }

  /**
   * 记录使用日志
   */
  async logUsage(params: {
    costPrice?: number;
    inputTokens: number;
    modelId: string;
    originalProvider: string;
    outputTokens: number;
    requestId?: string;
    userId: string;
    userPrice?: number;
  }): Promise<void> {
    await this.db.insert(protochatUsageLogs).values({
      costPrice: params.costPrice?.toString(),
      inputTokens: params.inputTokens,
      modelId: params.modelId,
      originalProvider: params.originalProvider,
      outputTokens: params.outputTokens,
      requestId: params.requestId,
      totalTokens: params.inputTokens + params.outputTokens,
      userId: params.userId,
      userPrice: params.userPrice?.toString(),
    });
  }

  /**
   * 获取所有启用的ProtoChat模型列表
   * 用于主项目获取模型列表
   */
  async getEnabledModels(): Promise<
    Array<{
      capabilities: Record<string, boolean> | null;
      contextTokens: number | null;
      displayName: string;
      id: string;
      maxOutput: number | null;
      type: string;
    }>
  > {
    const models = await this.db
      .select({
        capabilities: protochatModels.capabilities,
        contextTokens: protochatModels.contextTokens,
        displayName: protochatModels.displayName,
        id: protochatModels.id,
        maxOutput: protochatModels.maxOutput,
        type: protochatModels.type,
      })
      .from(protochatModels)
      .where(eq(protochatModels.enabled, true))
      .orderBy(protochatModels.displayName);

    return models.map((m) => ({
      ...m,
      capabilities: m.capabilities as Record<string, boolean> | null,
    }));
  }

  /**
   * 获取所有启用的底层供应商
   */
  async getEnabledProviders(): Promise<
    Array<{
      id: string;
      name: string;
      priority: number | null;
      type: string;
    }>
  > {
    const providers = await this.db
      .select({
        id: protochatProviders.id,
        name: protochatProviders.name,
        priority: protochatProviders.priority,
        type: protochatProviders.type,
      })
      .from(protochatProviders)
      .where(eq(protochatProviders.enabled, true))
      .orderBy(protochatProviders.priority);

    return providers;
  }

  /**
   * 检查是否为ProtoChat供应商
   */
  static isProtoChatProvider(providerId: string): boolean {
    return providerId === 'protochat' || providerId === 'ProtoChat';
  }
}
