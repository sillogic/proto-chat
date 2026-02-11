// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@lobechat/database';

import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { ProtoChatService } from './index';

// Mock KeyVaultsGateKeeper
vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn(),
  },
}));

describe('ProtoChatService', () => {
  let service: ProtoChatService;
  let mockDb: LobeChatDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {} as unknown as LobeChatDatabase;
    service = new ProtoChatService(mockDb);
  });

  describe('getModelMapping', () => {
    it('should return model mapping with exact model ID match', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        originalId: 'openrouter::openai/gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
        enabled: true,
      };

      const mockProvider = {
        id: 'openrouter',
        name: 'OpenRouter',
        enabled: true,
        apiKey: 'encrypted-key',
        baseUrl: 'https://openrouter.ai',
      };

      const mockOrderBy = vi.fn().mockResolvedValue([mockModel]);
      const mockWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockModel]) });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      // Mock provider query
      const providerOrderBy = vi.fn().mockResolvedValue([mockProvider]);
      const providerWhere = vi
        .fn()
        .mockReturnValue({ limit: vi.fn().mockResolvedValue([mockProvider]) });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: providerFrom });

      // Mock encryption
      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'test-api-key', baseURL: 'https://custom.url' }),
        }),
      };
      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue(mockGateKeeper);

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result).toEqual({
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.url',
        originalId: 'openrouter::openai/gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
      });
    });

    it('should use fuzzy match when exact match fails and model ID does not start with protochat::', async () => {
      const mockModel = {
        id: 'protochat::a1::gemini-2.5-flash',
        originalId: 'openrouter::google/gemini-2.5-flash',
        originalProvider: 'openrouter',
        type: 'chat',
        enabled: true,
      };

      const mockProvider = {
        id: 'openrouter',
        name: 'OpenRouter',
        enabled: true,
        apiKey: 'encrypted-key',
        baseUrl: 'https://openrouter.ai',
      };

      // First query returns empty (exact match fails)
      const exactMatchLimit = vi.fn().mockResolvedValue([]);
      const exactMatchWhere = vi.fn().mockReturnValue({ limit: exactMatchLimit });
      const exactMatchFrom = vi.fn().mockReturnValue({ where: exactMatchWhere });

      // Second query returns the model (fuzzy match succeeds)
      const fuzzyMatchLimit = vi.fn().mockResolvedValue([mockModel]);
      const fuzzyMatchWhere = vi.fn().mockReturnValue({ limit: fuzzyMatchLimit });
      const fuzzyMatchFrom = vi.fn().mockReturnValue({ where: fuzzyMatchWhere });

      // Provider query
      const providerLimit = vi.fn().mockResolvedValue([mockProvider]);
      const providerWhere = vi.fn().mockReturnValue({ limit: providerLimit });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: exactMatchFrom })
        .mockReturnValueOnce({ from: fuzzyMatchFrom })
        .mockReturnValueOnce({ from: providerFrom });

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'test-key' }),
        }),
      };
      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue(mockGateKeeper);

      const result = await service.getModelMapping('gemini-2.5-flash');

      expect(result.originalId).toBe('openrouter::google/gemini-2.5-flash');
    });

    it('should throw error when model is not found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      await expect(service.getModelMapping('non-existent-model')).rejects.toThrow(
        'ProtoChat model not found: non-existent-model',
      );
    });

    it('should throw error when model is disabled', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        enabled: false,
      };

      const mockLimit = vi.fn().mockResolvedValue([mockModel]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat model is disabled: protochat::a1::gpt-4o',
      );
    });

    it('should throw error when provider is not found', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        originalProvider: 'non-existent-provider',
        enabled: true,
      };

      const modelLimit = vi.fn().mockResolvedValue([mockModel]);
      const modelWhere = vi.fn().mockReturnValue({ limit: modelLimit });
      const modelFrom = vi.fn().mockReturnValue({ where: modelWhere });

      const providerLimit = vi.fn().mockResolvedValue([]);
      const providerWhere = vi.fn().mockReturnValue({ limit: providerLimit });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: modelFrom })
        .mockReturnValueOnce({ from: providerFrom });

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat provider not found: non-existent-provider',
      );
    });

    it('should throw error when provider is disabled', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        enabled: true,
      };

      const mockProvider = {
        id: 'openrouter',
        enabled: false,
      };

      const modelLimit = vi.fn().mockResolvedValue([mockModel]);
      const modelWhere = vi.fn().mockReturnValue({ limit: modelLimit });
      const modelFrom = vi.fn().mockReturnValue({ where: modelWhere });

      const providerLimit = vi.fn().mockResolvedValue([mockProvider]);
      const providerWhere = vi.fn().mockReturnValue({ limit: providerLimit });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: modelFrom })
        .mockReturnValueOnce({ from: providerFrom });

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat provider is disabled: openrouter',
      );
    });

    it('should throw error when no API key is found after decryption', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
        originalId: 'openrouter::openai/gpt-4o',
        enabled: true,
      };

      const mockProvider = {
        id: 'openrouter',
        enabled: true,
        apiKey: 'encrypted-key',
      };

      const modelLimit = vi.fn().mockResolvedValue([mockModel]);
      const modelWhere = vi.fn().mockReturnValue({ limit: modelLimit });
      const modelFrom = vi.fn().mockReturnValue({ where: modelWhere });

      const providerLimit = vi.fn().mockResolvedValue([mockProvider]);
      const providerWhere = vi.fn().mockReturnValue({ limit: providerLimit });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: modelFrom })
        .mockReturnValueOnce({ from: providerFrom });

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({}), // No apiKey in decrypted data
        }),
      };
      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue(mockGateKeeper);

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openrouter',
      );
    });

    it('should use baseUrl from keyVaults.baseURL if available', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        originalId: 'openrouter::openai/gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
        enabled: true,
      };

      const mockProvider = {
        id: 'openrouter',
        enabled: true,
        apiKey: 'encrypted-key',
        baseUrl: 'https://default.url',
      };

      const modelLimit = vi.fn().mockResolvedValue([mockModel]);
      const modelWhere = vi.fn().mockReturnValue({ limit: modelLimit });
      const modelFrom = vi.fn().mockReturnValue({ where: modelWhere });

      const providerLimit = vi.fn().mockResolvedValue([mockProvider]);
      const providerWhere = vi.fn().mockReturnValue({ limit: providerLimit });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: modelFrom })
        .mockReturnValueOnce({ from: providerFrom });

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'test-key', baseURL: 'https://priority.url' }),
        }),
      };
      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue(mockGateKeeper);

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://priority.url');
    });

    it('should use baseUrl from keyVaults.proxyUrl if baseURL not available', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        originalId: 'openrouter::openai/gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
        enabled: true,
      };

      const mockProvider = {
        id: 'openrouter',
        enabled: true,
        apiKey: 'encrypted-key',
        baseUrl: 'https://default.url',
      };

      const modelLimit = vi.fn().mockResolvedValue([mockModel]);
      const modelWhere = vi.fn().mockReturnValue({ limit: modelLimit });
      const modelFrom = vi.fn().mockReturnValue({ where: modelWhere });

      const providerLimit = vi.fn().mockResolvedValue([mockProvider]);
      const providerWhere = vi.fn().mockReturnValue({ limit: providerLimit });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: modelFrom })
        .mockReturnValueOnce({ from: providerFrom });

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'test-key', proxyUrl: 'https://proxy.url' }),
        }),
      };
      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue(mockGateKeeper);

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://proxy.url');
    });

    it('should use baseUrl from provider when no keyVaults baseUrl available', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        originalId: 'openrouter::openai/gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
        enabled: true,
      };

      const mockProvider = {
        id: 'openrouter',
        enabled: true,
        apiKey: 'encrypted-key',
        baseUrl: 'https://provider.url',
      };

      const modelLimit = vi.fn().mockResolvedValue([mockModel]);
      const modelWhere = vi.fn().mockReturnValue({ limit: modelLimit });
      const modelFrom = vi.fn().mockReturnValue({ where: modelWhere });

      const providerLimit = vi.fn().mockResolvedValue([mockProvider]);
      const providerWhere = vi.fn().mockReturnValue({ limit: providerLimit });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: modelFrom })
        .mockReturnValueOnce({ from: providerFrom });

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'test-key' }),
        }),
      };
      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue(mockGateKeeper);

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://provider.url');
    });

    it('should handle decryption errors gracefully', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
        originalId: 'openrouter::openai/gpt-4o',
        enabled: true,
      };

      const mockProvider = {
        id: 'openrouter',
        enabled: true,
        apiKey: 'encrypted-key',
      };

      const modelLimit = vi.fn().mockResolvedValue([mockModel]);
      const modelWhere = vi.fn().mockReturnValue({ limit: modelLimit });
      const modelFrom = vi.fn().mockReturnValue({ where: modelWhere });

      const providerLimit = vi.fn().mockResolvedValue([mockProvider]);
      const providerWhere = vi.fn().mockReturnValue({ limit: providerLimit });
      const providerFrom = vi.fn().mockReturnValue({ where: providerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: modelFrom })
        .mockReturnValueOnce({ from: providerFrom });

      const mockGateKeeper = {
        decrypt: vi.fn().mockRejectedValue(new Error('Decryption failed')),
      };
      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue(mockGateKeeper);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openrouter',
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('convertModelId', () => {
    it('should extract the last part after ::', () => {
      expect(service.convertModelId('openrouter::openai/gpt-4o')).toBe('openai/gpt-4o');
    });

    it('should return the original ID if no :: separator found', () => {
      expect(service.convertModelId('gpt-4o')).toBe('gpt-4o');
    });

    it('should handle multiple :: separators and return the last part', () => {
      expect(service.convertModelId('protochat::a1::openai/gpt-4o')).toBe('openai/gpt-4o');
    });

    it('should handle empty string', () => {
      expect(service.convertModelId('')).toBe('');
    });
  });

  describe('getModelPricing', () => {
    it('should return pricing data for a model', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '10.5',
        userOutputPrice: '20.3',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPricing]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getModelPricing('protochat::a1::gpt-4o');

      expect(result).toEqual({
        isFree: false,
        userInputPrice: 10.5,
        userOutputPrice: 20.3,
      });
    });

    it('should return null when pricing is not found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getModelPricing('non-existent-model');

      expect(result).toBeNull();
    });

    it('should mark model as free when both prices are 0', async () => {
      const mockPricing = {
        model: 'free-model',
        provider: 'protochat',
        userInputPrice: '0',
        userOutputPrice: '0',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPricing]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getModelPricing('free-model');

      expect(result?.isFree).toBe(true);
    });

    it('should not mark model as free when only input price is 0', async () => {
      const mockPricing = {
        model: 'semi-free-model',
        provider: 'protochat',
        userInputPrice: '0',
        userOutputPrice: '10',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPricing]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getModelPricing('semi-free-model');

      expect(result?.isFree).toBe(false);
    });
  });

  describe('getPricingMultiplier', () => {
    it('should return the pricing multiplier from settings', async () => {
      const mockSetting = {
        id: 'pricing_multiplier',
        value: '1.5',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockSetting]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getPricingMultiplier();

      expect(result).toBe(1.5);
    });

    it('should return 1 as default when setting is not found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getPricingMultiplier();

      expect(result).toBe(1);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for non-free model', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '10',
        userOutputPrice: '20',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPricing]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.calculateCost('protochat::a1::gpt-4o', 1_000_000, 500_000);

      // (1,000,000 / 1,000,000) * 10 + (500,000 / 1,000,000) * 20 = 10 + 10 = 20
      expect(result).toEqual({ cost: 20, isFree: false });
    });

    it('should return 0 cost for free models', async () => {
      const mockPricing = {
        model: 'free-model',
        provider: 'protochat',
        userInputPrice: '0',
        userOutputPrice: '0',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPricing]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.calculateCost('free-model', 1_000_000, 500_000);

      expect(result).toEqual({ cost: 0, isFree: true });
    });

    it('should return 0 cost when pricing is not found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.calculateCost('non-existent-model', 1_000_000, 500_000);

      expect(result).toEqual({ cost: 0, isFree: false });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ProtoChat] Pricing not found for model: non-existent-model',
      );

      consoleErrorSpy.mockRestore();
    });

    it('should ceil the total cost', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '5.5',
        userOutputPrice: '10.3',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPricing]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      // (100,000 / 1,000,000) * 5.5 + (50,000 / 1,000,000) * 10.3 = 0.55 + 0.515 = 1.065
      const result = await service.calculateCost('protochat::a1::gpt-4o', 100_000, 50_000);

      expect(result.cost).toBe(2); // ceil(1.065) = 2
    });

    it('should handle zero tokens', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '10',
        userOutputPrice: '20',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPricing]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.calculateCost('protochat::a1::gpt-4o', 0, 0);

      expect(result).toEqual({ cost: 0, isFree: false });
    });
  });

  describe('logUsage', () => {
    it('should insert usage log with all parameters', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.insert = mockInsert;

      await service.logUsage({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 1000,
        outputTokens: 500,
        costPrice: 0.05,
        userPrice: 0.1,
        requestId: 'req-123',
      });

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.results[0].value.values;
      expect(insertCall).toHaveBeenCalledWith({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        costPrice: '0.05',
        userPrice: '0.1',
        requestId: 'req-123',
      });
    });

    it('should handle optional parameters', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.insert = mockInsert;

      await service.logUsage({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 1000,
        outputTokens: 500,
      });

      const insertCall = mockInsert.mock.results[0].value.values;
      expect(insertCall).toHaveBeenCalledWith({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        costPrice: undefined,
        userPrice: undefined,
        requestId: undefined,
      });
    });
  });

  describe('getEnabledModels', () => {
    it('should return enabled models sorted by display name', async () => {
      const mockModels = [
        {
          id: 'protochat::a1::gpt-4o',
          displayName: 'GPT-4o',
          type: 'chat',
          capabilities: { vision: true, functionCall: true },
          contextTokens: 128000,
          maxOutput: 4096,
        },
        {
          id: 'protochat::a1::claude-3',
          displayName: 'Claude 3',
          type: 'chat',
          capabilities: { vision: true },
          contextTokens: 200000,
          maxOutput: 4096,
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockModels);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getEnabledModels();

      expect(result).toEqual(mockModels);
      expect(result).toHaveLength(2);
    });

    it('should handle models with null capabilities', async () => {
      const mockModels = [
        {
          id: 'protochat::a1::basic-model',
          displayName: 'Basic Model',
          type: 'chat',
          capabilities: null,
          contextTokens: null,
          maxOutput: null,
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockModels);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getEnabledModels();

      expect(result[0].capabilities).toBeNull();
    });

    it('should return empty array when no enabled models', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getEnabledModels();

      expect(result).toEqual([]);
    });
  });

  describe('getEnabledProviders', () => {
    it('should return enabled providers sorted by priority', async () => {
      const mockProviders = [
        {
          id: 'openrouter',
          name: 'OpenRouter',
          type: 'aggregator',
          priority: 1,
        },
        {
          id: 'deepseek',
          name: 'DeepSeek',
          type: 'direct',
          priority: 2,
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockProviders);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getEnabledProviders();

      expect(result).toEqual(mockProviders);
      expect(result).toHaveLength(2);
    });

    it('should handle providers with null priority', async () => {
      const mockProviders = [
        {
          id: 'provider1',
          name: 'Provider 1',
          type: 'aggregator',
          priority: null,
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockProviders);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getEnabledProviders();

      expect(result[0].priority).toBeNull();
    });

    it('should return empty array when no enabled providers', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.getEnabledProviders();

      expect(result).toEqual([]);
    });
  });

  describe('isProtoChatProvider', () => {
    it('should return true for "protochat" provider ID', () => {
      expect(ProtoChatService.isProtoChatProvider('protochat')).toBe(true);
    });

    it('should return true for "ProtoChat" provider ID with capital letters', () => {
      expect(ProtoChatService.isProtoChatProvider('ProtoChat')).toBe(true);
    });

    it('should return false for other provider IDs', () => {
      expect(ProtoChatService.isProtoChatProvider('openai')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('anthropic')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('')).toBe(false);
    });
  });
});
