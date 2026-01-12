import { and, eq } from 'drizzle-orm';

import {
  LobeChatDatabase,
  protochatModelPricing,
  protochatModels,
  protochatProviders,
  protochatSettings,
  protochatUsageLogs,
} from '@lobechat/database';

/**
 * ProtoChat模型映射信息
 */
export interface ProtoChatModelMapping {
  /** 原始模型ID，如 'openrouter::openai/gpt-4o' */
  originalId: string;
  /** 原始供应商ID，如 'openrouter' */
  originalProvider: string;
  /** 底层供应商的API Key */
  apiKey: string;
  /** 底层供应商的Base URL */
  baseUrl: string;
  /** 模型类型: 'chat' | 'image' | 'embedding' */
  type: string;
}

/**
 * ProtoChat定价信息
 */
export interface ProtoChatPricing {
  /** 用户价格 - 输入（积分/百万tokens） */
  userInputPrice: number;
  /** 用户价格 - 输出（积分/百万tokens） */
  userOutputPrice: number;
  /** 是否免费 */
  isFree: boolean;
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
   * @param modelId ProtoChat模型ID，如 'protochat::gpt-4o'
   */
  async getModelMapping(modelId: string): Promise<ProtoChatModelMapping> {
    // 查询模型
    const model = await this.db
      .select()
      .from(protochatModels)
      .where(eq(protochatModels.id, modelId))
      .limit(1);

    if (!model.length) {
      throw new Error(`ProtoChat model not found: ${modelId}`);
    }

    const modelData = model[0];

    if (!modelData.enabled) {
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

    return {
      originalId: modelData.originalId,
      originalProvider: modelData.originalProvider,
      apiKey: providerData.apiKey || '',
      baseUrl: providerData.baseUrl || '',
      type: modelData.type,
    };
  }

  /**
   * 转换模型ID
   * 从 'openrouter::openai/gpt-4o' 提取 'openai/gpt-4o'
   */
  convertModelId(originalId: string): string {
    const parts = originalId.split('::');
    return parts[parts.length - 1];
  }

  /**
   * 获取模型定价
   * @param modelId ProtoChat模型ID
   */
  async getModelPricing(modelId: string): Promise<ProtoChatPricing | null> {
    const pricing = await this.db
      .select()
      .from(protochatModelPricing)
      .where(eq(protochatModelPricing.modelId, modelId))
      .limit(1);

    if (!pricing.length) {
      return null;
    }

    const pricingData = pricing[0];

    return {
      userInputPrice: Number(pricingData.userInputPrice),
      userOutputPrice: Number(pricingData.userOutputPrice),
      isFree: pricingData.isFree || false,
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
      return 1.0; // 默认系数
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
    userId: string;
    modelId: string;
    originalProvider: string;
    inputTokens: number;
    outputTokens: number;
    costPrice?: number;
    userPrice?: number;
    requestId?: string;
  }): Promise<void> {
    await this.db.insert(protochatUsageLogs).values({
      userId: params.userId,
      modelId: params.modelId,
      originalProvider: params.originalProvider,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.inputTokens + params.outputTokens,
      costPrice: params.costPrice?.toString(),
      userPrice: params.userPrice?.toString(),
      requestId: params.requestId,
    });
  }

  /**
   * 获取所有启用的ProtoChat模型列表
   * 用于主项目获取模型列表
   */
  async getEnabledModels(): Promise<
    Array<{
      id: string;
      displayName: string;
      type: string;
      capabilities: Record<string, boolean> | null;
      contextTokens: number | null;
      maxOutput: number | null;
    }>
  > {
    const models = await this.db
      .select({
        id: protochatModels.id,
        displayName: protochatModels.displayName,
        type: protochatModels.type,
        capabilities: protochatModels.capabilities,
        contextTokens: protochatModels.contextTokens,
        maxOutput: protochatModels.maxOutput,
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
      type: string;
      priority: number | null;
    }>
  > {
    const providers = await this.db
      .select({
        id: protochatProviders.id,
        name: protochatProviders.name,
        type: protochatProviders.type,
        priority: protochatProviders.priority,
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
