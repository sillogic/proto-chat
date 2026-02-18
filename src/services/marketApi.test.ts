import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKET_ENDPOINTS } from '@/services/_url';

import { MarketApiService } from './marketApi';

// Helper to create a mock Response
const mockResponse = (
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
};

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockFetch = (response: Response) => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);
  };

  const getMockFetchCall = (callIndex = 0) => {
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const call = calls[callIndex] as [string, Record<string, unknown>];
    return { url: call[0], init: call[1] };
  };

  describe('setAccessToken', () => {
    it('should set the access token used for requests', async () => {
      service.setAccessToken('test-token-123');
      mockFetch(mockResponse(200, { id: 1, identifier: 'agent-1' }));

      await service.getAgentDetail('agent-1');

      const { init } = getMockFetchCall();
      const headers = init.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer test-token-123');
    });

    it('should not set authorization header when no access token', async () => {
      mockFetch(mockResponse(200, { id: 1, identifier: 'agent-1' }));

      await service.getAgentDetail('agent-1');

      const { init } = getMockFetchCall();
      const headers = init.headers as Headers;
      expect(headers.get('authorization')).toBeNull();
    });
  });

  describe('request (via getAgentDetail)', () => {
    it('should use same-origin credentials by default', async () => {
      mockFetch(mockResponse(200, { id: 1 }));

      await service.getAgentDetail('agent-1');

      const { init } = getMockFetchCall();
      expect(init.credentials).toBe('same-origin');
    });

    it('should set content-type header automatically for POST requests with body', async () => {
      mockFetch(mockResponse(200, { id: 1 }));

      await service.createAgent({ identifier: 'new-agent', name: 'New Agent' });

      const { init } = getMockFetchCall();
      const headers = init.headers as Headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should throw an error when response is not ok with JSON error body', async () => {
      mockFetch(mockResponse(400, { message: 'Bad request' }));

      await expect(service.getAgentDetail('bad-agent')).rejects.toThrow('Bad request');
    });

    it('should throw an error with text body when JSON parsing fails', async () => {
      const textErrorResponse = {
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      } as unknown as Response;

      mockFetch(textErrorResponse);

      await expect(service.getAgentDetail('agent-1')).rejects.toThrow('Internal Server Error');
    });

    it('should throw with "Unknown error" when error body has no message field', async () => {
      mockFetch(mockResponse(400, { code: 'INVALID' }));

      await expect(service.getAgentDetail('agent-1')).rejects.toThrow('Unknown error');
    });

    it('should return undefined for 204 No Content responses', async () => {
      const noContentResponse = {
        ok: true,
        status: 204,
        json: vi.fn(),
        text: vi.fn(),
      } as unknown as Response;

      mockFetch(noContentResponse);

      const result = await service.createAgent({ identifier: 'agent-id', name: 'Agent' });
      expect(result).toBeUndefined();
    });

    it('should not override authorization header if already set via setAccessToken', async () => {
      service.setAccessToken('service-token');
      mockFetch(mockResponse(200, { id: 1 }));

      await service.getAgentDetail('agent-1');

      const { init } = getMockFetchCall();
      const headers = init.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer service-token');
    });
  });

  describe('createAgent', () => {
    it('should POST to the createAgent endpoint with agent data', async () => {
      const agentData = {
        identifier: 'my-agent',
        name: 'My Agent',
        homepage: 'https://example.com',
        isFeatured: true,
        status: 'published' as const,
        visibility: 'public' as const,
        tokenUsage: 100,
      };

      mockFetch(mockResponse(200, { id: 42, ...agentData }));

      const result = await service.createAgent(agentData);

      const { url, init } = getMockFetchCall();
      expect(url).toBe(MARKET_ENDPOINTS.createAgent);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify(agentData));
      expect(result).toMatchObject({ id: 42, identifier: 'my-agent' });
    });

    it('should work with minimal required fields', async () => {
      const minimalData = { identifier: 'basic-agent', name: 'Basic Agent' };
      mockFetch(mockResponse(200, { id: 1, ...minimalData }));

      await service.createAgent(minimalData);

      const { init } = getMockFetchCall();
      expect(init.body).toBe(JSON.stringify(minimalData));
      expect(init.method).toBe('POST');
    });
  });

  describe('getAgentDetail', () => {
    it('should GET the agent detail endpoint with encoded identifier', async () => {
      const identifier = 'my-agent';
      mockFetch(mockResponse(200, { id: 1, identifier }));

      const result = await service.getAgentDetail(identifier);

      const { url, init } = getMockFetchCall();
      expect(url).toBe(MARKET_ENDPOINTS.getAgentDetail(identifier));
      expect(init.method).toBe('GET');
      expect(result).toMatchObject({ identifier });
    });

    it('should handle identifiers with special characters', async () => {
      const identifier = 'agent/with-slash';
      mockFetch(mockResponse(200, { id: 2, identifier }));

      await service.getAgentDetail(identifier);

      const { url } = getMockFetchCall();
      expect(url).toBe(MARKET_ENDPOINTS.getAgentDetail(identifier));
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when agent is found', async () => {
      mockFetch(mockResponse(200, { id: 1, identifier: 'existing-agent' }));

      const result = await service.checkAgentExists('existing-agent');

      expect(result).toBe(true);
    });

    it('should return false when agent is not found (throws error)', async () => {
      mockFetch(mockResponse(404, { message: 'Not Found' }));

      const result = await service.checkAgentExists('non-existent-agent');

      expect(result).toBe(false);
    });

    it('should return false when any error occurs during fetch', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const result = await service.checkAgentExists('agent-1');

      expect(result).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should POST to createAgentVersion endpoint with version data', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'My Agent v1',
        description: 'First version',
        avatar: 'https://example.com/avatar.png',
        setAsCurrent: true,
      };

      mockFetch(mockResponse(200, { id: 10, ...versionData }));

      const result = await service.createAgentVersion(versionData);

      const { url, init } = getMockFetchCall();
      expect(url).toBe(MARKET_ENDPOINTS.createAgentVersion);
      expect(init.method).toBe('POST');
      const sentBody = JSON.parse(init.body as string);
      expect(sentBody.identifier).toBe('my-agent');
      expect(sentBody.name).toBe('My Agent v1');
      expect(result).toMatchObject({ id: 10 });
    });

    it('should throw when identifier is missing', async () => {
      await expect(
        service.createAgentVersion({
          identifier: '',
          name: 'Agent',
        }),
      ).rejects.toThrow('Identifier is required');
    });

    it('should spread remaining fields alongside identifier in request body', async () => {
      const versionData = {
        identifier: 'agent-x',
        changelog: 'Initial release',
        hasStreaming: true,
        tokenUsage: 50,
      };

      mockFetch(mockResponse(200, { id: 5 }));

      await service.createAgentVersion(versionData);

      const { init } = getMockFetchCall();
      const sentBody = JSON.parse(init.body as string);
      expect(sentBody).toEqual({
        identifier: 'agent-x',
        changelog: 'Initial release',
        hasStreaming: true,
        tokenUsage: 50,
      });
    });

    it('should include authorization token in version creation request', async () => {
      service.setAccessToken('my-token');
      mockFetch(mockResponse(200, { id: 1 }));

      await service.createAgentVersion({ identifier: 'agent-y', name: 'Agent Y' });

      const { init } = getMockFetchCall();
      const headers = init.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer my-token');
    });
  });
});
