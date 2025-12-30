import { authEnv } from '@/envs/auth';

import type {
  CasdoorApiResponse,
  CasdoorCreateUserRequest,
  CasdoorTokenError,
  CasdoorTokenResponse,
  CasdoorUserInfo,
} from './types';

/**
 * Casdoor ROPC (Resource Owner Password Credentials) Client
 *
 * This client provides methods for:
 * - ROPC token authentication (login with username/password)
 * - User info retrieval
 * - User creation (signup)
 */
export class CasdoorClient {
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly organization: string;

  constructor(config?: {
    clientId?: string;
    clientSecret?: string;
    issuer?: string;
    organization?: string;
  }) {
    const issuer = config?.issuer || authEnv.AUTH_CASDOOR_ISSUER;
    const clientId = config?.clientId || authEnv.AUTH_CASDOOR_ID;
    const clientSecret = config?.clientSecret || authEnv.AUTH_CASDOOR_SECRET;

    if (!issuer || !clientId || !clientSecret) {
      throw new Error(
        'Casdoor configuration is incomplete. Please set AUTH_CASDOOR_ISSUER, AUTH_CASDOOR_ID, and AUTH_CASDOOR_SECRET environment variables.',
      );
    }

    // Remove trailing slash from issuer
    this.issuer = issuer.replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    // Default organization name, can be overridden
    this.organization = config?.organization || 'lobechat';
  }

  /**
   * Get access token using ROPC (Resource Owner Password Credentials) flow
   *
   * @param username - User's username or email
   * @param password - User's password
   * @returns Token response with access_token, refresh_token, etc.
   */
  async getToken(username: string, password: string): Promise<CasdoorTokenResponse> {
    const url = `${this.issuer}/api/login/oauth/access_token`;

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'password',
      password,
      scope: 'openid profile email',
      username,
    });

    const response = await fetch(url, {
      body: body.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const error = data as CasdoorTokenError;
      throw new Error(error.error_description || error.error || 'Authentication failed');
    }

    return data as CasdoorTokenResponse;
  }

  /**
   * Get user info using access token
   *
   * @param accessToken - Access token from getToken()
   * @returns User information
   */
  async getUserInfo(accessToken: string): Promise<CasdoorUserInfo> {
    const url = `${this.issuer}/api/userinfo`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return response.json();
  }

  /**
   * Create a new user in Casdoor
   *
   * @param userData - User data for creation
   * @returns Created user object
   */
  async createUser(userData: Omit<CasdoorCreateUserRequest, 'owner'>): Promise<void> {
    const url = `${this.issuer}/api/add-user`;

    // Build user object with required fields
    const user: CasdoorCreateUserRequest = {
      ...userData,
      displayName: userData.displayName || userData.name, // Auto-set displayName to username
      owner: this.organization,
      type: userData.type || 'normal-user',
    };

    // Casdoor expects the user data directly, NOT wrapped in {"user": ...}
    const response = await fetch(url, {
      body: JSON.stringify(user),
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const data: CasdoorApiResponse<string> = await response.json();

    if (data.status !== 'ok') {
      throw new Error(data.msg || 'Failed to create user');
    }

    // Note: Casdoor returns data: "Affected" on success, not the user object
  }

  /**
   * Check if Casdoor ROPC is properly configured
   */
  static isConfigured(): boolean {
    return !!(
      authEnv.AUTH_CASDOOR_ISSUER &&
      authEnv.AUTH_CASDOOR_ID &&
      authEnv.AUTH_CASDOOR_SECRET
    );
  }
}

// Export types
export * from './types';
