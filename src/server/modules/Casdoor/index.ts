// Casdoor SSO client implementation
// Requires environment variables: CASDOOR_ENDPOINT, CASDOOR_CLIENT_ID, CASDOOR_CLIENT_SECRET, CASDOOR_ORG_NAME

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface UserInfo {
  avatar?: string;
  displayName?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  permanentAvatar?: string;
  preferred_username?: string;
  sub?: string;
}

export class CasdoorClient {
  private endpoint: string;
  private clientId: string;
  private clientSecret: string;
  private orgName: string;

  constructor() {
    this.endpoint = process.env.CASDOOR_ENDPOINT || '';
    this.clientId = process.env.CASDOOR_CLIENT_ID || '';
    this.clientSecret = process.env.CASDOOR_CLIENT_SECRET || '';
    this.orgName = process.env.CASDOOR_ORG_NAME || '';
  }

  static isConfigured(): boolean {
    return !!(
      process.env.CASDOOR_ENDPOINT &&
      process.env.CASDOOR_CLIENT_ID &&
      process.env.CASDOOR_CLIENT_SECRET
    );
  }

  async getToken(identifier: string, password: string): Promise<TokenResponse> {
    const url = `${this.endpoint}/api/login/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'password',
      password,
      scope: 'read',
      username: identifier,
    });

    const response = await fetch(url, {
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Casdoor token request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const url = `${this.endpoint}/api/userinfo`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info from Casdoor: ${response.statusText}`);
    }

    return response.json();
  }
}
