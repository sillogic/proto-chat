import { beforeEach, describe, expect, it, vi } from 'vitest';

import { discoverService } from '../discover';

// Mock dependencies
vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    market: {
      getAssistantCategories: { query: vi.fn() },
      getAssistantDetail: { query: vi.fn() },
      getAssistantIdentifiers: { query: vi.fn() },
      getAssistantList: { query: vi.fn() },
      getMcpCategories: { query: vi.fn() },
      getMcpDetail: { query: vi.fn() },
      getMcpList: { query: vi.fn() },
      getMcpManifest: { query: vi.fn() },
      getModelCategories: { query: vi.fn() },
      getModelDetail: { query: vi.fn() },
      getModelIdentifiers: { query: vi.fn() },
      getModelList: { query: vi.fn() },
      getPluginCategories: { query: vi.fn() },
      getPluginDetail: { query: vi.fn() },
      getPluginIdentifiers: { query: vi.fn() },
      getPluginList: { query: vi.fn() },
      getProviderDetail: { query: vi.fn() },
      getProviderIdentifiers: { query: vi.fn() },
      getProviderList: { query: vi.fn() },
      registerClientInMarketplace: { mutate: vi.fn() },
      registerM2MToken: { query: vi.fn() },
      reportMcpInstallResult: { mutate: vi.fn() },
      reportCall: { mutate: vi.fn() },
    },
  },
}));

vi.mock('@/store/global/helpers', () => ({
  globalHelpers: {
    getCurrentLanguage: vi.fn(() => 'en-US'),
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: {
    getState: vi.fn(() => ({})),
  },
}));

vi.mock('@/store/user/selectors', () => ({
  preferenceSelectors: {
    userAllowTrace: vi.fn(() => true),
  },
}));

// Use real cleanObject since it has no side effects
vi.mock('@/utils/object', () => ({
  cleanObject: <T extends Record<string, any>>(obj: T): T => {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        result[key] = obj[key];
      }
    }
    return result as T;
  },
}));

describe('DiscoverService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    // Reset document.cookie to empty
    Object.defineProperty(globalThis, 'document', {
      value: { cookie: '' },
      writable: true,
    });
  });

  // ============================== Assistant Market ==============================

  describe('getAssistantCategories', () => {
    it('should call with current language and no extra params when called with defaults', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockCategories = [{ id: '1', name: 'General' }];
      vi.mocked(lambdaClient.market.getAssistantCategories.query).mockResolvedValue(
        mockCategories as any,
      );

      const result = await discoverService.getAssistantCategories();

      expect(result).toEqual(mockCategories);
      expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith({
        locale: 'en-US',
        source: undefined,
      });
    });

    it('should pass through source and extra params', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getAssistantCategories.query).mockResolvedValue([]);

      await discoverService.getAssistantCategories({ source: 'lobehub' as any });

      expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith({
        locale: 'en-US',
        source: 'lobehub',
      });
    });
  });

  describe('getAssistantDetail', () => {
    it('should inject locale and forward identifier', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockDetail = { identifier: 'coding-wizard', locale: 'en-US' };
      vi.mocked(lambdaClient.market.getAssistantDetail.query).mockResolvedValue(
        mockDetail as any,
      );

      const result = await discoverService.getAssistantDetail({ identifier: 'coding-wizard' });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getAssistantDetail.query).toHaveBeenCalledWith({
        identifier: 'coding-wizard',
        locale: 'en-US',
        source: undefined,
        version: undefined,
      });
    });

    it('should pass source and version when provided', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getAssistantDetail.query).mockResolvedValue(undefined);

      await discoverService.getAssistantDetail({
        identifier: 'test-agent',
        source: 'custom' as any,
        version: '1.0.0',
      });

      expect(lambdaClient.market.getAssistantDetail.query).toHaveBeenCalledWith({
        identifier: 'test-agent',
        locale: 'en-US',
        source: 'custom',
        version: '1.0.0',
      });
    });
  });

  describe('getAssistantIdentifiers', () => {
    it('should call without locale', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockResponse = { items: ['agent-1', 'agent-2'] };
      vi.mocked(lambdaClient.market.getAssistantIdentifiers.query).mockResolvedValue(
        mockResponse as any,
      );

      const result = await discoverService.getAssistantIdentifiers();

      expect(result).toEqual(mockResponse);
      expect(lambdaClient.market.getAssistantIdentifiers.query).toHaveBeenCalledWith({});
    });

    it('should pass source param when provided', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getAssistantIdentifiers.query).mockResolvedValue({} as any);

      await discoverService.getAssistantIdentifiers({ source: 'lobehub' as any });

      expect(lambdaClient.market.getAssistantIdentifiers.query).toHaveBeenCalledWith({
        source: 'lobehub',
      });
    });
  });

  describe('getAssistantList', () => {
    it('should use default pagination (page=1, pageSize=20) when no params given', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockResponse = { items: [], total: 0 };
      vi.mocked(lambdaClient.market.getAssistantList.query).mockResolvedValue(
        mockResponse as any,
      );

      const result = await discoverService.getAssistantList();

      expect(result).toEqual(mockResponse);
      expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
        {
          locale: 'en-US',
          page: 1,
          pageSize: 20,
        },
        { context: { showNotification: false } },
      );
    });

    it('should convert string page/pageSize to numbers', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getAssistantList.query).mockResolvedValue({} as any);

      await discoverService.getAssistantList({ page: '3' as any, pageSize: '15' as any });

      expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
        {
          locale: 'en-US',
          page: 3,
          pageSize: 15,
        },
        { context: { showNotification: false } },
      );
    });

    it('should pass search query through to query params', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getAssistantList.query).mockResolvedValue({} as any);

      await discoverService.getAssistantList({ q: 'code assistant', page: 2, pageSize: 10 });

      expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
        {
          locale: 'en-US',
          q: 'code assistant',
          page: 2,
          pageSize: 10,
        },
        { context: { showNotification: false } },
      );
    });
  });

  // ============================== MCP Market ==============================

  describe('getMcpCategories', () => {
    it('should inject locale into query params', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockCategories = [{ id: 'cat-1', name: 'Tools' }];
      vi.mocked(lambdaClient.market.getMcpCategories.query).mockResolvedValue(
        mockCategories as any,
      );

      const result = await discoverService.getMcpCategories();

      expect(result).toEqual(mockCategories);
      expect(lambdaClient.market.getMcpCategories.query).toHaveBeenCalledWith({ locale: 'en-US' });
    });
  });

  describe('getMcpDetail', () => {
    it('should inject locale and pass identifier', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockDetail = { identifier: 'brave-search', version: '1.0' };
      vi.mocked(lambdaClient.market.getMcpDetail.query).mockResolvedValue(mockDetail as any);

      const result = await discoverService.getMcpDetail({ identifier: 'brave-search' });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getMcpDetail.query).toHaveBeenCalledWith({
        identifier: 'brave-search',
        locale: 'en-US',
      });
    });

    it('should include version when provided', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getMcpDetail.query).mockResolvedValue({} as any);

      await discoverService.getMcpDetail({ identifier: 'brave-search', version: '2.0.0' });

      expect(lambdaClient.market.getMcpDetail.query).toHaveBeenCalledWith({
        identifier: 'brave-search',
        locale: 'en-US',
        version: '2.0.0',
      });
    });
  });

  describe('getMcpList', () => {
    it('should use default pagination when called without params', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockResponse = { items: [], total: 0 };
      vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue(mockResponse as any);

      const result = await discoverService.getMcpList();

      expect(result).toEqual(mockResponse);
      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith({
        locale: 'en-US',
        page: 1,
        pageSize: 20,
      });
    });

    it('should convert string page and pageSize to numbers', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue({} as any);

      await discoverService.getMcpList({ page: '2' as any, pageSize: '50' as any });

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith({
        locale: 'en-US',
        page: 2,
        pageSize: 50,
      });
    });
  });

  describe('getMCPPluginList', () => {
    it('should use pageSize=21 (different from getMcpList default of 20)', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue({ items: [] } as any);
      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
        success: true,
      } as any);

      // Simulate token already active via cookie
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'mp_token_status=active' },
        writable: true,
      });

      await discoverService.getMCPPluginList({ page: 1, pageSize: 0 });

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 21 }),
      );
    });

    it('should default page to 1 and pageSize to 21 when not provided', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue({ items: [] } as any);

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'mp_token_status=active' },
        writable: true,
      });

      await discoverService.getMCPPluginList({});

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 21 }),
      );
    });
  });

  describe('getMcpManifest', () => {
    it('should inject locale and forward identifier', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockManifest = { identifier: 'brave-search', tools: [] };
      vi.mocked(lambdaClient.market.getMcpManifest.query).mockResolvedValue(mockManifest as any);

      const result = await discoverService.getMcpManifest({ identifier: 'brave-search' });

      expect(result).toEqual(mockManifest);
      expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith({
        identifier: 'brave-search',
        locale: 'en-US',
      });
    });
  });

  describe('getMCPPluginManifest', () => {
    it('should inject locale and forward identifier with install option', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockManifest = { identifier: 'test-plugin', tools: [] };
      vi.mocked(lambdaClient.market.getMcpManifest.query).mockResolvedValue(mockManifest as any);

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'mp_token_status=active' },
        writable: true,
      });

      const result = await discoverService.getMCPPluginManifest('test-plugin', { install: true });

      expect(result).toEqual(mockManifest);
      expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith({
        identifier: 'test-plugin',
        install: true,
        locale: 'en-US',
      });
    });

    it('should default install to undefined when no options provided', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getMcpManifest.query).mockResolvedValue({} as any);

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'mp_token_status=active' },
        writable: true,
      });

      await discoverService.getMCPPluginManifest('my-plugin');

      expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith({
        identifier: 'my-plugin',
        install: undefined,
        locale: 'en-US',
      });
    });
  });

  describe('registerClient', () => {
    it('should call the mutate endpoint', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockClientInfo = { clientId: 'client-123', clientSecret: 'secret-abc' };
      vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue(
        mockClientInfo as any,
      );

      const result = await discoverService.registerClient();

      expect(result).toEqual(mockClientInfo);
      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalledWith({});
    });
  });

  // ============================== Models ==============================

  describe('getModelCategories', () => {
    it('should pass params directly without locale injection', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockCategories = [{ id: 'cat-1', name: 'NLP' }];
      vi.mocked(lambdaClient.market.getModelCategories.query).mockResolvedValue(
        mockCategories as any,
      );

      const result = await discoverService.getModelCategories();

      expect(result).toEqual(mockCategories);
      expect(lambdaClient.market.getModelCategories.query).toHaveBeenCalledWith({});
    });
  });

  describe('getModelDetail', () => {
    it('should inject locale and forward identifier', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockDetail = { identifier: 'gpt-4o', provider: 'openai' };
      vi.mocked(lambdaClient.market.getModelDetail.query).mockResolvedValue(mockDetail as any);

      const result = await discoverService.getModelDetail({ identifier: 'gpt-4o' });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getModelDetail.query).toHaveBeenCalledWith({
        identifier: 'gpt-4o',
        locale: 'en-US',
      });
    });
  });

  describe('getModelIdentifiers', () => {
    it('should query without parameters', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockResponse = { items: ['gpt-4o', 'claude-3-5-sonnet'] };
      vi.mocked(lambdaClient.market.getModelIdentifiers.query).mockResolvedValue(
        mockResponse as any,
      );

      const result = await discoverService.getModelIdentifiers();

      expect(result).toEqual(mockResponse);
      expect(lambdaClient.market.getModelIdentifiers.query).toHaveBeenCalledWith();
    });
  });

  describe('getModelList', () => {
    it('should default to page=1 and pageSize=20', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getModelList.query).mockResolvedValue({ items: [] } as any);

      await discoverService.getModelList();

      expect(lambdaClient.market.getModelList.query).toHaveBeenCalledWith({
        locale: 'en-US',
        page: 1,
        pageSize: 20,
      });
    });

    it('should convert string pagination to numbers', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getModelList.query).mockResolvedValue({} as any);

      await discoverService.getModelList({ page: '5' as any, pageSize: '30' as any });

      expect(lambdaClient.market.getModelList.query).toHaveBeenCalledWith({
        locale: 'en-US',
        page: 5,
        pageSize: 30,
      });
    });
  });

  // ============================== Plugin Market ==============================

  describe('getPluginCategories', () => {
    it('should inject locale into params', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getPluginCategories.query).mockResolvedValue([]);

      await discoverService.getPluginCategories();

      expect(lambdaClient.market.getPluginCategories.query).toHaveBeenCalledWith({
        locale: 'en-US',
      });
    });
  });

  describe('getPluginDetail', () => {
    it('should inject locale and forward identifier', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockDetail = { identifier: 'web-search', version: '1.0' };
      vi.mocked(lambdaClient.market.getPluginDetail.query).mockResolvedValue(mockDetail as any);

      const result = await discoverService.getPluginDetail({ identifier: 'web-search' });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getPluginDetail.query).toHaveBeenCalledWith({
        identifier: 'web-search',
        locale: 'en-US',
      });
    });

    it('should pass withManifest when provided', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getPluginDetail.query).mockResolvedValue(undefined);

      await discoverService.getPluginDetail({ identifier: 'web-search', withManifest: true });

      expect(lambdaClient.market.getPluginDetail.query).toHaveBeenCalledWith({
        identifier: 'web-search',
        locale: 'en-US',
        withManifest: true,
      });
    });
  });

  describe('getPluginIdentifiers', () => {
    it('should query without parameters', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockResponse = { items: ['web-search', 'dalle'] };
      vi.mocked(lambdaClient.market.getPluginIdentifiers.query).mockResolvedValue(
        mockResponse as any,
      );

      const result = await discoverService.getPluginIdentifiers();

      expect(result).toEqual(mockResponse);
      expect(lambdaClient.market.getPluginIdentifiers.query).toHaveBeenCalledWith();
    });
  });

  describe('getPluginList', () => {
    it('should use default pagination', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getPluginList.query).mockResolvedValue({ items: [] } as any);

      await discoverService.getPluginList();

      expect(lambdaClient.market.getPluginList.query).toHaveBeenCalledWith({
        locale: 'en-US',
        page: 1,
        pageSize: 20,
      });
    });

    it('should respect explicit pagination', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getPluginList.query).mockResolvedValue({} as any);

      await discoverService.getPluginList({ page: 3, pageSize: 5 });

      expect(lambdaClient.market.getPluginList.query).toHaveBeenCalledWith({
        locale: 'en-US',
        page: 3,
        pageSize: 5,
      });
    });
  });

  // ============================== Providers ==============================

  describe('getProviderDetail', () => {
    it('should inject locale and forward identifier', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockDetail = { identifier: 'openai', name: 'OpenAI' };
      vi.mocked(lambdaClient.market.getProviderDetail.query).mockResolvedValue(mockDetail as any);

      const result = await discoverService.getProviderDetail({ identifier: 'openai' });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getProviderDetail.query).toHaveBeenCalledWith({
        identifier: 'openai',
        locale: 'en-US',
      });
    });

    it('should include withReadme when provided', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getProviderDetail.query).mockResolvedValue(undefined);

      await discoverService.getProviderDetail({ identifier: 'anthropic', withReadme: true });

      expect(lambdaClient.market.getProviderDetail.query).toHaveBeenCalledWith({
        identifier: 'anthropic',
        locale: 'en-US',
        withReadme: true,
      });
    });
  });

  describe('getProviderIdentifiers', () => {
    it('should query without parameters', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const mockResponse = { items: ['openai', 'anthropic'] };
      vi.mocked(lambdaClient.market.getProviderIdentifiers.query).mockResolvedValue(
        mockResponse as any,
      );

      const result = await discoverService.getProviderIdentifiers();

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProviderList', () => {
    it('should inject locale and use default pagination', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      vi.mocked(lambdaClient.market.getProviderList.query).mockResolvedValue({ items: [] } as any);

      await discoverService.getProviderList();

      expect(lambdaClient.market.getProviderList.query).toHaveBeenCalledWith({
        locale: 'en-US',
        page: 1,
        pageSize: 20,
      });
    });
  });

  // ============================== reportMcpInstallResult ==============================

  describe('reportMcpInstallResult', () => {
    it('should not report when user has not allowed tracing', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');
      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(false);

      await discoverService.reportMcpInstallResult({
        success: true,
        identifier: 'test-plugin',
      } as any);

      expect(lambdaClient.market.reportMcpInstallResult.mutate).not.toHaveBeenCalled();
    });

    it('should omit manifest and include error fields on failure', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');
      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
      vi.mocked(lambdaClient.market.reportMcpInstallResult.mutate).mockResolvedValue(
        undefined as any,
      );

      // Token already active
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'mp_token_status=active' },
        writable: true,
      });

      await discoverService.reportMcpInstallResult({
        success: false,
        identifier: 'failing-plugin',
        version: '1.0.0',
        errorCode: 'TIMEOUT',
        errorMessage: 'Connection timed out',
        manifest: { tools: [] } as any,
      });

      // Reporting is fire-and-forget; give it time to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lambdaClient.market.reportMcpInstallResult.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          identifier: 'failing-plugin',
          errorCode: 'TIMEOUT',
          errorMessage: 'Connection timed out',
        }),
      );

      // manifest should be omitted on failure
      const callArg = vi.mocked(lambdaClient.market.reportMcpInstallResult.mutate).mock.calls[0][0];
      expect((callArg as any).manifest).toBeUndefined();
    });

    it('should include manifest and omit error fields on success', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');
      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
      vi.mocked(lambdaClient.market.reportMcpInstallResult.mutate).mockResolvedValue(
        undefined as any,
      );

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'mp_token_status=active' },
        writable: true,
      });

      const mockManifest = { identifier: 'good-plugin', tools: ['search'] };

      await discoverService.reportMcpInstallResult({
        success: true,
        identifier: 'good-plugin',
        version: '1.0.0',
        errorCode: 'TIMEOUT',
        errorMessage: 'Should be stripped',
        manifest: mockManifest as any,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const callArg = vi.mocked(lambdaClient.market.reportMcpInstallResult.mutate).mock.calls[0][0];
      expect((callArg as any).success).toBe(true);
      expect((callArg as any).manifest).toEqual(mockManifest);
      // errorCode and errorMessage should be undefined on success
      expect((callArg as any).errorCode).toBeUndefined();
      expect((callArg as any).errorMessage).toBeUndefined();
    });
  });

  // ============================== reportPluginCall ==============================

  describe('reportPluginCall', () => {
    it('should not report when user has not allowed tracing', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');
      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(false);

      await discoverService.reportPluginCall({
        identifier: 'test-plugin',
        methodName: 'search',
        success: true,
      } as any);

      expect(lambdaClient.market.reportCall.mutate).not.toHaveBeenCalled();
    });

    it('should call reportCall mutate when tracing is allowed', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');
      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
      vi.mocked(lambdaClient.market.reportCall.mutate).mockResolvedValue(undefined as any);

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'mp_token_status=active' },
        writable: true,
      });

      const reportData = {
        identifier: 'brave-search',
        methodName: 'search',
        success: true,
        requestSizeBytes: 128,
        responseSizeBytes: 512,
      };

      await discoverService.reportPluginCall(reportData as any);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lambdaClient.market.reportCall.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'brave-search',
          methodName: 'search',
          success: true,
        }),
      );
    });
  });

  // ============================== injectMPToken ==============================

  describe('injectMPToken', () => {
    it('should return early when localStorage is undefined', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      // Simulate server-side environment (no localStorage)
      Object.defineProperty(globalThis, 'localStorage', {
        value: undefined,
        writable: true,
      });

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();
      expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
    });

    it('should return early when mp_token_status cookie is active', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'other=value; mp_token_status=active; another=foo' },
        writable: true,
      });

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();
    });

    it('should register a new client when _mpc is missing from localStorage', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: '' },
        writable: true,
      });

      vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue({
        clientId: 'new-client-id',
        clientSecret: 'new-client-secret',
      } as any);
      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
        success: true,
      } as any);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalledWith({});
      expect(globalThis.localStorage!.setItem).toHaveBeenCalledWith(
        '_mpc',
        expect.any(String),
      );
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
        clientId: 'new-client-id',
        clientSecret: 'new-client-secret',
      });
    });

    it('should use existing _mpc from localStorage when available', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const storedData = btoa(
        JSON.stringify({ clientId: 'stored-client', clientSecret: 'stored-secret' }),
      );

      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn(() => storedData),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: '' },
        writable: true,
      });

      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
        success: true,
      } as any);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
        clientId: 'stored-client',
        clientSecret: 'stored-secret',
      });
    });

    it('should re-register and clear _mpc when localStorage data is corrupted', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn(() => 'INVALID_BASE64!!!'),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: '' },
        writable: true,
      });

      vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue({
        clientId: 'fresh-client',
        clientSecret: 'fresh-secret',
      } as any);
      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
        success: true,
      } as any);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalledWith({});
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
        clientId: 'fresh-client',
        clientSecret: 'fresh-secret',
      });
    });

    it('should clear _mpc and retry once when token registration returns success=false', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const storedData = btoa(
        JSON.stringify({ clientId: 'bad-client', clientSecret: 'bad-secret' }),
      );

      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn(() => storedData),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: '' },
        writable: true,
      });

      // First call returns failure; retry call returns success
      vi.mocked(lambdaClient.market.registerM2MToken.query)
        .mockResolvedValueOnce({ success: false } as any)
        .mockResolvedValueOnce({ success: true } as any);

      await discoverService.injectMPToken();

      // localStorage should be cleared after failure
      expect(globalThis.localStorage!.removeItem).toHaveBeenCalledWith('_mpc');
      // registerM2MToken should have been called twice (initial + retry)
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledTimes(2);
    });

    it('should return null on token registration exception', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const storedData = btoa(
        JSON.stringify({ clientId: 'error-client', clientSecret: 'error-secret' }),
      );

      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn(() => storedData),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: '' },
        writable: true,
      });

      vi.mocked(lambdaClient.market.registerM2MToken.query).mockRejectedValue(
        new Error('Network error'),
      );

      // Should not throw
      const result = await discoverService.injectMPToken();
      expect(result).toBeNull();
    });
  });

  // ============================== getTokenStatusFromCookie (private, tested via injectMPToken) ==============================

  describe('getTokenStatusFromCookie (via injectMPToken behavior)', () => {
    it('should detect active token status from cookie and skip M2M token registration', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'session=abc123; mp_token_status=active; user_id=42' },
        writable: true,
      });

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();
    });

    it('should proceed with token registration when cookie is not set', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: 'session=abc123; other=value' },
        writable: true,
      });

      const storedData = btoa(
        JSON.stringify({ clientId: 'test-client', clientSecret: 'test-secret' }),
      );

      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn(() => storedData),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
        success: true,
      } as any);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalled();
    });

    it('should handle empty cookie string and proceed with registration', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      Object.defineProperty(globalThis, 'document', {
        value: { cookie: '' },
        writable: true,
      });

      const storedData = btoa(
        JSON.stringify({ clientId: 'empty-cookie-client', clientSecret: 'secret' }),
      );

      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn(() => storedData),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
        success: true,
      } as any);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
        clientId: 'empty-cookie-client',
        clientSecret: 'secret',
      });
    });
  });
});
