// @vitest-environment node
import { MarketSDK } from '@lobehub/market-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocks are set up
import { generateTrustedClientToken, getTrustedClientTokenForSession } from '@/libs/trusted-client';

import { extractAccessToken, type LobehubSkillExecuteParams, MarketService } from './index';

// Mock dependencies
vi.mock('debug', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('@/libs/trusted-client', () => ({
  generateTrustedClientToken: vi.fn(),
  getTrustedClientTokenForSession: vi.fn(),
}));

const mockMarketSDKInstance = {
  feedback: {
    submitFeedback: vi.fn(),
  },
  auth: {
    exchangeOAuthToken: vi.fn(),
    getOAuthHandoff: vi.fn(),
    getUserInfo: vi.fn(),
  },
  skills: {
    listTools: vi.fn(),
    callTool: vi.fn(),
  },
  connect: {
    listConnections: vi.fn(),
  },
  plugins: {
    callCloudGateway: vi.fn(),
    runBuildInTool: vi.fn(),
    getPluginManifest: vi.fn(),
    reportInstallation: vi.fn(),
    reportCall: vi.fn(),
    createEvent: vi.fn(),
  },
  agents: {
    getAgentDetail: vi.fn(),
    getAgentList: vi.fn(),
    increaseInstallCount: vi.fn(),
    createEvent: vi.fn(),
  },
  agentGroups: {
    getAgentGroupDetail: vi.fn(),
    getAgentGroupList: vi.fn(),
  },
  user: {
    getUserInfo: vi.fn(),
    register: vi.fn(),
  },
  fetchM2MToken: vi.fn(),
  registerClient: vi.fn(),
  headers: { 'x-trusted-client': 'token' },
};

vi.mock('@lobehub/market-sdk', () => ({
  MarketSDK: vi.fn(() => mockMarketSDKInstance),
}));

describe('extractAccessToken', () => {
  it('should extract token from a valid Bearer Authorization header', () => {
    const req = {
      headers: { get: vi.fn().mockReturnValue('Bearer my-access-token') },
    } as any;

    const result = extractAccessToken(req);

    expect(result).toBe('my-access-token');
  });

  it('should return undefined when Authorization header is missing', () => {
    const req = {
      headers: { get: vi.fn().mockReturnValue(null) },
    } as any;

    const result = extractAccessToken(req);

    expect(result).toBeUndefined();
  });

  it('should return undefined when Authorization header does not start with Bearer', () => {
    const req = {
      headers: { get: vi.fn().mockReturnValue('Basic dXNlcjpwYXNz') },
    } as any;

    const result = extractAccessToken(req);

    expect(result).toBeUndefined();
  });

  it('should return empty string for a "Bearer " header with no token', () => {
    const req = {
      headers: { get: vi.fn().mockReturnValue('Bearer ') },
    } as any;

    const result = extractAccessToken(req);

    expect(result).toBe('');
  });
});

describe('MarketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================== Constructor ==============================

  describe('constructor', () => {
    it('should initialize MarketSDK without any options', () => {
      new MarketService();

      expect(MarketSDK).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.any(String),
        }),
      );
    });

    it('should pass accessToken to MarketSDK when provided', () => {
      new MarketService({ accessToken: 'user-token' });

      expect(MarketSDK).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'user-token' }),
      );
    });

    it('should generate trustedClientToken from userInfo when provided', () => {
      const userInfo = { userId: 'user-1', email: 'test@example.com', name: 'Test' };
      vi.mocked(generateTrustedClientToken).mockReturnValue('generated-trusted-token');

      new MarketService({ userInfo });

      expect(generateTrustedClientToken).toHaveBeenCalledWith(userInfo);
      expect(MarketSDK).toHaveBeenCalledWith(
        expect.objectContaining({ trustedClientToken: 'generated-trusted-token' }),
      );
    });

    it('should prefer trustedClientToken over generating from userInfo', () => {
      const userInfo = { userId: 'user-1' };
      vi.mocked(generateTrustedClientToken).mockReturnValue('generated-token');

      new MarketService({ userInfo, trustedClientToken: 'explicit-token' });

      expect(generateTrustedClientToken).not.toHaveBeenCalled();
      expect(MarketSDK).toHaveBeenCalledWith(
        expect.objectContaining({ trustedClientToken: 'explicit-token' }),
      );
    });

    it('should pass clientCredentials to MarketSDK', () => {
      new MarketService({
        clientCredentials: { clientId: 'cid', clientSecret: 'csecret' },
      });

      expect(MarketSDK).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'cid', clientSecret: 'csecret' }),
      );
    });
  });

  // ============================== Factory Methods ==============================

  describe('createFromRequest', () => {
    it('should create MarketService with access token and trusted client token from request', async () => {
      const req = {
        headers: { get: vi.fn().mockReturnValue('Bearer req-access-token') },
      } as any;
      vi.mocked(getTrustedClientTokenForSession).mockResolvedValue('session-trusted-token');

      const service = await MarketService.createFromRequest(req);

      expect(getTrustedClientTokenForSession).toHaveBeenCalled();
      expect(service).toBeInstanceOf(MarketService);
      expect(MarketSDK).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'req-access-token',
          trustedClientToken: 'session-trusted-token',
        }),
      );
    });

    it('should create MarketService without access token when Authorization header is absent', async () => {
      const req = {
        headers: { get: vi.fn().mockReturnValue(null) },
      } as any;
      vi.mocked(getTrustedClientTokenForSession).mockResolvedValue(undefined);

      const service = await MarketService.createFromRequest(req);

      expect(service).toBeInstanceOf(MarketService);
      expect(MarketSDK).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: undefined,
          trustedClientToken: undefined,
        }),
      );
    });
  });

  // ============================== submitFeedback ==============================

  describe('submitFeedback', () => {
    it('should call market.feedback.submitFeedback with given params', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.feedback.submitFeedback.mockResolvedValue({ success: true });

      await service.submitFeedback({
        title: 'Bug Report',
        message: 'Something broke',
        email: 'user@example.com',
      });

      expect(mockMarketSDKInstance.feedback.submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bug Report',
          message: 'Something broke',
          email: 'user@example.com',
        }),
      );
    });

    it('should append screenshot URL to message when screenshotUrl is provided', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.feedback.submitFeedback.mockResolvedValue({ success: true });

      await service.submitFeedback({
        title: 'Bug Report',
        message: 'Something broke',
        screenshotUrl: 'https://example.com/screenshot.png',
      });

      expect(mockMarketSDKInstance.feedback.submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Something broke\n\n**Screenshot**: https://example.com/screenshot.png',
        }),
      );
    });

    it('should not modify message when no screenshotUrl is provided', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.feedback.submitFeedback.mockResolvedValue({ success: true });

      await service.submitFeedback({
        title: 'Feedback',
        message: 'Great app!',
      });

      expect(mockMarketSDKInstance.feedback.submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Great app!' }),
      );
    });

    it('should use empty string for email when email is not provided', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.feedback.submitFeedback.mockResolvedValue({ success: true });

      await service.submitFeedback({ title: 'Title', message: 'Message' });

      expect(mockMarketSDKInstance.feedback.submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ email: '' }),
      );
    });
  });

  // ============================== executeLobehubSkill ==============================

  describe('executeLobehubSkill', () => {
    it('should return content and success when skill call succeeds with string data', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.skills.callTool.mockResolvedValue({
        success: true,
        data: 'tool result',
      });

      const params: LobehubSkillExecuteParams = {
        provider: 'twitter',
        toolName: 'search_tweets',
        args: { query: 'hello' },
      };
      const result = await service.executeLobehubSkill(params);

      expect(mockMarketSDKInstance.skills.callTool).toHaveBeenCalledWith('twitter', {
        args: { query: 'hello' },
        tool: 'search_tweets',
      });
      expect(result).toEqual({ content: 'tool result', success: true });
    });

    it('should JSON.stringify non-string data response', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.skills.callTool.mockResolvedValue({
        success: true,
        data: { tweets: ['tweet1', 'tweet2'] },
      });

      const result = await service.executeLobehubSkill({
        provider: 'twitter',
        toolName: 'search_tweets',
        args: {},
      });

      expect(result.content).toBe(JSON.stringify({ tweets: ['tweet1', 'tweet2'] }));
      expect(result.success).toBe(true);
    });

    it('should return error object when skill call throws an error', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.skills.callTool.mockRejectedValue(new Error('Network error'));

      const result = await service.executeLobehubSkill({
        provider: 'linear',
        toolName: 'create_issue',
        args: {},
      });

      expect(result).toEqual({
        content: 'Network error',
        error: { code: 'LOBEHUB_SKILL_ERROR', message: 'Network error' },
        success: false,
      });
    });
  });

  // ============================== getLobehubSkillManifests ==============================

  describe('getLobehubSkillManifests', () => {
    it('should return empty array when no connections found', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.connect.listConnections.mockResolvedValue({ connections: [] });

      const result = await service.getLobehubSkillManifests();

      expect(result).toEqual([]);
    });

    it('should return empty array when connections is null/undefined', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.connect.listConnections.mockResolvedValue({ connections: null });

      const result = await service.getLobehubSkillManifests();

      expect(result).toEqual([]);
    });

    it('should build manifest for each connection with tools', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.connect.listConnections.mockResolvedValue({
        connections: [{ providerId: 'twitter', providerName: 'Twitter', icon: '🐦' }],
      });
      mockMarketSDKInstance.skills.listTools.mockResolvedValue({
        tools: [
          {
            name: 'search_tweets',
            description: 'Search tweets',
            inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
          },
        ],
      });

      const result = await service.getLobehubSkillManifests();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        identifier: 'twitter',
        type: 'builtin',
        meta: {
          avatar: '🐦',
          title: 'Twitter',
          tags: ['lobehub-skill', 'twitter'],
        },
        api: [
          {
            name: 'search_tweets',
            description: 'Search tweets',
          },
        ],
      });
    });

    it('should skip connections with no providerId', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.connect.listConnections.mockResolvedValue({
        connections: [{ name: 'No Provider ID Connection' }],
      });

      const result = await service.getLobehubSkillManifests();

      expect(result).toEqual([]);
      expect(mockMarketSDKInstance.skills.listTools).not.toHaveBeenCalled();
    });

    it('should skip connections that return empty tools list', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.connect.listConnections.mockResolvedValue({
        connections: [{ providerId: 'slack', providerName: 'Slack' }],
      });
      mockMarketSDKInstance.skills.listTools.mockResolvedValue({ tools: [] });

      const result = await service.getLobehubSkillManifests();

      expect(result).toEqual([]);
    });

    it('should fall back to default avatar when icon is not provided', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.connect.listConnections.mockResolvedValue({
        connections: [{ providerId: 'github', providerName: 'GitHub' }],
      });
      mockMarketSDKInstance.skills.listTools.mockResolvedValue({
        tools: [{ name: 'create_issue', description: 'Create issue' }],
      });

      const result = await service.getLobehubSkillManifests();

      expect(result[0].meta.avatar).toBe('🔗');
    });

    it('should return empty array and not throw when listConnections fails', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.connect.listConnections.mockRejectedValue(new Error('Network error'));

      const result = await service.getLobehubSkillManifests();

      expect(result).toEqual([]);
    });

    it('should continue processing other connections when one fails to fetch tools', async () => {
      const service = new MarketService();
      mockMarketSDKInstance.connect.listConnections.mockResolvedValue({
        connections: [
          { providerId: 'broken', providerName: 'Broken' },
          { providerId: 'linear', providerName: 'Linear', icon: '🔷' },
        ],
      });
      mockMarketSDKInstance.skills.listTools
        .mockRejectedValueOnce(new Error('Fetch failed'))
        .mockResolvedValueOnce({
          tools: [{ name: 'create_issue', description: 'Create issue', inputSchema: {} }],
        });

      const result = await service.getLobehubSkillManifests();

      expect(result).toHaveLength(1);
      expect(result[0].identifier).toBe('linear');
    });
  });

  // ============================== getSDK ==============================

  describe('getSDK', () => {
    it('should return the internal MarketSDK instance', () => {
      const service = new MarketService();

      const sdk = service.getSDK();

      expect(sdk).toBe(mockMarketSDKInstance);
    });
  });
});
