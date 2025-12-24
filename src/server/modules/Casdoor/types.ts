/**
 * Casdoor ROPC (Resource Owner Password Credentials) API Types
 */

// ============ Token API ============

export interface CasdoorTokenRequest {
  client_id: string;
  client_secret: string;
  grant_type: 'password';
  password: string;
  scope?: string;
  username: string;
}

export interface CasdoorTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

export interface CasdoorTokenError {
  error: string;
  error_description?: string;
}

// ============ User Info API ============

export interface CasdoorUserInfo {
  aud: string;
  avatar?: string;
  // Additional Casdoor fields
  displayName?: string;
  email: string;
  email_verified?: boolean;
  firstName?: string;
  iss: string;
  lastName?: string;
  name: string;
  permanentAvatar?: string;
  phone?: string;
  preferred_username?: string;
  sub: string;
}

// ============ Create User API ============

export interface CasdoorCreateUserRequest {
  avatar?: string;
  displayName?: string;
  email: string;
  name: string;
  owner: string;
  password: string;
  phone?: string;
  type?: string;
}

export interface CasdoorUser {
  avatar?: string;
  createdTime?: string;
  displayName: string;
  email: string;
  id: string;
  name: string;
  owner: string;
  phone?: string;
  type?: string;
}

export interface CasdoorApiResponse<T = unknown> {
  data?: T;
  data2?: unknown;
  msg: string;
  status: 'ok' | 'error';
}

// ============ Login Request/Response for API Routes ============

export interface CasdoorLoginRequest {
  identifier: string; // email or username
  password: string;
}

export interface CasdoorLoginResponse {
  callbackUrl?: string;
  error?: string;
  success: boolean;
}

export interface CasdoorSignupRequest {
  email: string;
  password: string;
  username: string;
}

export interface CasdoorSignupResponse {
  callbackUrl?: string;
  error?: string;
  success: boolean;
}
