export interface CasdoorLoginRequest {
  identifier: string;
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
  username?: string;
}

export interface CasdoorSignupResponse {
  callbackUrl?: string;
  error?: string;
  success: boolean;
}
