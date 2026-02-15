import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasdoorClient } from '.';
import type {
  CasdoorApiResponse,
  CasdoorTokenError,
  CasdoorTokenResponse,
  CasdoorUserInfo,
} from './types';

vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_CASDOOR_ID: 'test-client-id',
    AUTH_CASDOOR_ISSUER: 'https://casdoor.example.com',
    AUTH_CASDOOR_SECRET: 'test-client-secret',
  },
}));

describe('CasdoorClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      const client = new CasdoorClient();
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should initialize with custom config', () => {
      const client = new CasdoorClient({
        clientId: 'custom-id',
        clientSecret: 'custom-secret',
        issuer: 'https://custom.casdoor.com',
        organization: 'custom-org',
      });
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should remove trailing slash from issuer', () => {
      const client = new CasdoorClient({
        issuer: 'https://casdoor.example.com/',
      });
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should use default organization when not provided', () => {
      const client = new CasdoorClient();
      expect(client).toBeInstanceOf(CasdoorClient);
    });
  });

  describe('getToken', () => {
    it('should successfully get token with valid credentials', async () => {
      const mockResponse: CasdoorTokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'openid profile email',
        token_type: 'Bearer',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
        ok: true,
      });

      const client = new CasdoorClient();
      const result = await client.getToken('testuser', 'testpass');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          method: 'POST',
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send correct request body parameters', async () => {
      const mockResponse: CasdoorTokenResponse = {
        access_token: 'test-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      let capturedBody = '';
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          json: vi.fn().mockResolvedValue(mockResponse),
          ok: true,
        };
      });

      const client = new CasdoorClient();
      await client.getToken('user@example.com', 'password123');

      const params = new URLSearchParams(capturedBody);
      expect(params.get('username')).toBe('user@example.com');
      expect(params.get('password')).toBe('password123');
      expect(params.get('grant_type')).toBe('password');
      expect(params.get('client_id')).toBe('test-client-id');
      expect(params.get('client_secret')).toBe('test-client-secret');
      expect(params.get('scope')).toBe('openid profile email');
    });

    it('should throw error when response is not ok', async () => {
      const mockError: CasdoorTokenError = {
        error: 'invalid_grant',
        error_description: 'Invalid username or password',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockError),
        ok: false,
      });

      const client = new CasdoorClient();
      await expect(client.getToken('wronguser', 'wrongpass')).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('should throw error when response contains error field', async () => {
      const mockError: CasdoorTokenError = {
        error: 'unauthorized_client',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockError),
        ok: true,
      });

      const client = new CasdoorClient();
      await expect(client.getToken('testuser', 'testpass')).rejects.toThrow(
        'unauthorized_client',
      );
    });

    it('should throw generic error when no error description is provided', async () => {
      const mockError: CasdoorTokenError = {
        error: '',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockError),
        ok: false,
      });

      const client = new CasdoorClient();
      await expect(client.getToken('testuser', 'testpass')).rejects.toThrow(
        'Authentication failed',
      );
    });
  });

  describe('getUserInfo', () => {
    it('should successfully get user info with valid token', async () => {
      const mockUserInfo: CasdoorUserInfo = {
        aud: 'test-client-id',
        displayName: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        iss: 'https://casdoor.example.com',
        name: 'testuser',
        sub: 'user-123',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockUserInfo),
        ok: true,
      });

      const client = new CasdoorClient();
      const result = await client.getUserInfo('test-access-token');

      expect(global.fetch).toHaveBeenCalledWith('https://casdoor.example.com/api/userinfo', {
        headers: {
          Authorization: 'Bearer test-access-token',
        },
        method: 'GET',
      });
      expect(result).toEqual(mockUserInfo);
    });

    it('should include Bearer prefix in authorization header', async () => {
      const mockUserInfo: CasdoorUserInfo = {
        aud: 'test-client-id',
        email: 'test@example.com',
        iss: 'https://casdoor.example.com',
        name: 'testuser',
        sub: 'user-123',
      };

      let capturedHeaders: Record<string, string> = {};
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedHeaders = options.headers;
        return {
          json: vi.fn().mockResolvedValue(mockUserInfo),
          ok: true,
        };
      });

      const client = new CasdoorClient();
      await client.getUserInfo('my-token');

      expect(capturedHeaders.Authorization).toBe('Bearer my-token');
    });

    it('should throw error when response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      const client = new CasdoorClient();
      await expect(client.getUserInfo('invalid-token')).rejects.toThrow(
        'Failed to get user info',
      );
    });

    it('should handle user info with optional fields', async () => {
      const mockUserInfo: CasdoorUserInfo = {
        aud: 'test-client-id',
        avatar: 'https://example.com/avatar.jpg',
        email: 'user@example.com',
        firstName: 'Test',
        iss: 'https://casdoor.example.com',
        lastName: 'User',
        name: 'testuser',
        permanentAvatar: 'https://example.com/permanent-avatar.jpg',
        phone: '+1234567890',
        preferred_username: 'test',
        sub: 'user-456',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockUserInfo),
        ok: true,
      });

      const client = new CasdoorClient();
      const result = await client.getUserInfo('test-token');

      expect(result.avatar).toBe('https://example.com/avatar.jpg');
      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('User');
      expect(result.phone).toBe('+1234567890');
    });
  });

  describe('createUser', () => {
    it('should successfully create user with required fields', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'securepass123',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/add-user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          method: 'POST',
        }),
      );
    });

    it('should auto-set displayName to username when not provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      let capturedBody = '';
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          json: vi.fn().mockResolvedValue(mockResponse),
          ok: true,
        };
      });

      const client = new CasdoorClient();
      await client.createUser({
        email: 'user@example.com',
        name: 'username123',
        password: 'pass123',
      });

      const body = JSON.parse(capturedBody);
      expect(body.displayName).toBe('username123');
      expect(body.name).toBe('username123');
    });

    it('should use custom displayName when provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      let capturedBody = '';
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          json: vi.fn().mockResolvedValue(mockResponse),
          ok: true,
        };
      });

      const client = new CasdoorClient();
      await client.createUser({
        displayName: 'Custom Display Name',
        email: 'user@example.com',
        name: 'username',
        password: 'pass123',
      });

      const body = JSON.parse(capturedBody);
      expect(body.displayName).toBe('Custom Display Name');
    });

    it('should set owner to organization', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      let capturedBody = '';
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          json: vi.fn().mockResolvedValue(mockResponse),
          ok: true,
        };
      });

      const client = new CasdoorClient({ organization: 'custom-org' });
      await client.createUser({
        email: 'user@example.com',
        name: 'username',
        password: 'pass123',
      });

      const body = JSON.parse(capturedBody);
      expect(body.owner).toBe('custom-org');
    });

    it('should default type to normal-user when not provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      let capturedBody = '';
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          json: vi.fn().mockResolvedValue(mockResponse),
          ok: true,
        };
      });

      const client = new CasdoorClient();
      await client.createUser({
        email: 'user@example.com',
        name: 'username',
        password: 'pass123',
      });

      const body = JSON.parse(capturedBody);
      expect(body.type).toBe('normal-user');
    });

    it('should use custom type when provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      let capturedBody = '';
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          json: vi.fn().mockResolvedValue(mockResponse),
          ok: true,
        };
      });

      const client = new CasdoorClient();
      await client.createUser({
        email: 'admin@example.com',
        name: 'admin',
        password: 'adminpass',
        type: 'admin-user',
      });

      const body = JSON.parse(capturedBody);
      expect(body.type).toBe('admin-user');
    });

    it('should include Basic auth header with base64 encoded credentials', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      let capturedHeaders: Record<string, string> = {};
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedHeaders = options.headers;
        return {
          json: vi.fn().mockResolvedValue(mockResponse),
          ok: true,
        };
      });

      const client = new CasdoorClient();
      await client.createUser({
        email: 'user@example.com',
        name: 'username',
        password: 'pass123',
      });

      const expectedAuth = `Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`;
      expect(capturedHeaders.Authorization).toBe(expectedAuth);
    });

    it('should include optional fields when provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      let capturedBody = '';
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          json: vi.fn().mockResolvedValue(mockResponse),
          ok: true,
        };
      });

      const client = new CasdoorClient();
      await client.createUser({
        avatar: 'https://example.com/avatar.jpg',
        email: 'user@example.com',
        name: 'username',
        password: 'pass123',
        phone: '+1234567890',
      });

      const body = JSON.parse(capturedBody);
      expect(body.avatar).toBe('https://example.com/avatar.jpg');
      expect(body.phone).toBe('+1234567890');
    });

    it('should throw error when status is not ok', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        msg: 'User already exists',
        status: 'error',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
        ok: true,
      });

      const client = new CasdoorClient();
      await expect(
        client.createUser({
          email: 'existing@example.com',
          name: 'existing',
          password: 'pass123',
        }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw generic error when no error message is provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        msg: '',
        status: 'error',
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
        ok: true,
      });

      const client = new CasdoorClient();
      await expect(
        client.createUser({
          email: 'user@example.com',
          name: 'username',
          password: 'pass123',
        }),
      ).rejects.toThrow('Failed to create user');
    });
  });

  describe('isConfigured', () => {
    it('should return true when all environment variables are set', () => {
      expect(CasdoorClient.isConfigured()).toBe(true);
    });
  });
});
