import { authEnv } from '@/envs/auth';

/**
 * Cookie signing utilities for Better Auth session tokens
 *
 * Better Auth uses HMAC-SHA256 signed cookies in the format: {value}.{base64_signature}
 * This module provides utilities to create compatible signed cookies.
 *
 * When cookieCache is enabled, Better Auth expects TWO cookies:
 * 1. session_token - The signed session token
 * 2. session_data - The cached session data with HMAC signature
 */

const ALGORITHM = { hash: 'SHA-256', name: 'HMAC' };

// Cookie cache max age in seconds (matches auth.ts config)
const COOKIE_CACHE_MAX_AGE = 10 * 60; // 10 minutes

/**
 * Create a crypto key from the secret
 */
const getCryptoKey = async (secret: string): Promise<CryptoKey> => {
  const secretBuf = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey('raw', secretBuf, ALGORITHM, false, ['sign']);
};

/**
 * Create an HMAC-SHA256 signature in base64 format (standard base64)
 */
const makeSignature = async (value: string, secret: string): Promise<string> => {
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign(ALGORITHM.name, key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

/**
 * Create an HMAC-SHA256 signature in base64url format without padding
 * (matches Better Auth's createHMAC("SHA-256", "base64urlnopad"))
 */
const makeBase64UrlSignature = async (value: string, secret: string): Promise<string> => {
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign(ALGORITHM.name, key, new TextEncoder().encode(value));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  // Convert to base64url without padding
  return base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

/**
 * Encode string to base64url without padding
 */
const base64UrlEncode = (str: string): string => {
  const base64 = btoa(str);
  return base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

/**
 * Create a signed cookie value compatible with Better Auth
 *
 * @param value - The raw value to sign (e.g., session token)
 * @param secret - The signing secret (AUTH_SECRET)
 * @returns The signed value in format: {value}.{signature}
 */
export const createSignedCookieValue = async (value: string, secret?: string): Promise<string> => {
  const signingSecret = secret ?? authEnv.AUTH_SECRET;
  if (!signingSecret) {
    throw new Error('AUTH_SECRET is required for cookie signing');
  }

  const signature = await makeSignature(value, signingSecret);
  return `${value}.${signature}`;
};

/**
 * Session data for cookie cache
 */
export interface SessionData {
  session: {
    createdAt: Date;
    expiresAt: Date;
    id: string;
    ipAddress: string | null;
    token: string;
    updatedAt: Date;
    userAgent: string | null;
    userId: string;
  };
  user: {
    avatar: string | null;
    createdAt?: Date;
    email: string;
    emailVerified: boolean;
    fullName: string;
    id: string;
    updatedAt?: Date;
    username: string | null;
  };
}

/**
 * Session cookie configuration
 */
export interface SessionCookieOptions {
  expiresAt: Date;
  /** Protocol from X-Forwarded-Proto header (e.g., 'http' or 'https') */
  protocol?: string | null;
  secure?: boolean;
  sessionData: SessionData;
  sessionToken: string;
}

/**
 * Create the session_data cookie value for Better Auth's cookieCache
 *
 * Better Auth's compact strategy format:
 * base64url(JSON.stringify({ session: sessionData, expiresAt, signature }))
 */
const createSessionDataCookieValue = async (
  sessionData: SessionData,
  secret: string,
): Promise<string> => {
  const now = Date.now();
  const expiresAt = now + COOKIE_CACHE_MAX_AGE * 1000;

  // Build session payload matching Better Auth's format
  const sessionPayload = {
    session: {
      createdAt: sessionData.session.createdAt.toISOString(),
      expiresAt: sessionData.session.expiresAt.toISOString(),
      id: sessionData.session.id,
      ipAddress: sessionData.session.ipAddress,
      token: sessionData.session.token,
      updatedAt: sessionData.session.updatedAt.toISOString(),
      userAgent: sessionData.session.userAgent,
      userId: sessionData.session.userId,
    },
    updatedAt: now,
    user: {
      ...(sessionData.user.avatar && { image: sessionData.user.avatar }),
      createdAt: sessionData.user.createdAt?.toISOString(),
      email: sessionData.user.email,
      emailVerified: sessionData.user.emailVerified,
      id: sessionData.user.id,
      name: sessionData.user.fullName,
      updatedAt: sessionData.user.updatedAt?.toISOString(),
      ...(sessionData.user.username && { username: sessionData.user.username }),
    },
    version: '1',
  };

  // Create signature payload (session + expiresAt)
  const signaturePayload = JSON.stringify({
    ...sessionPayload,
    expiresAt,
  });

  const signature = await makeBase64UrlSignature(signaturePayload, secret);

  // Build final cookie value
  const cookiePayload = {
    expiresAt,
    session: sessionPayload,
    signature,
  };

  return base64UrlEncode(JSON.stringify(cookiePayload));
};

/**
 * Create signed session cookies header values for Better Auth
 *
 * Returns an array of Set-Cookie header values:
 * 1. session_token - The signed session token
 * 2. session_data - The cached session data (for cookieCache)
 *
 * @param options - Session cookie options
 * @returns Array of Set-Cookie header values
 */
export const createSignedSessionCookies = async (
  options: SessionCookieOptions,
): Promise<string[]> => {
  const {
    sessionToken,
    expiresAt,
    sessionData,
    protocol,
    secure = protocol ? protocol === 'https' : process.env.NODE_ENV === 'production',
  } = options;

  const signingSecret = authEnv.AUTH_SECRET;
  if (!signingSecret) {
    throw new Error('AUTH_SECRET is required for cookie signing');
  }

  const cookies: string[] = [];

  // 1. Create session_token cookie
  const signedValue = await createSignedCookieValue(sessionToken);
  const encodedValue = encodeURIComponent(signedValue);

  const tokenParts = [
    `better-auth.session_token=${encodedValue}`,
    `Path=/`,
    `Expires=${expiresAt.toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (secure) {
    tokenParts.push('Secure');
  }

  cookies.push(tokenParts.join('; '));

  // 2. Create session_data cookie (for cookieCache)
  const sessionDataValue = await createSessionDataCookieValue(sessionData, signingSecret);
  const sessionDataExpiresAt = new Date(Date.now() + COOKIE_CACHE_MAX_AGE * 1000);

  const dataParts = [
    `better-auth.session_data=${sessionDataValue}`,
    `Path=/`,
    `Expires=${sessionDataExpiresAt.toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (secure) {
    dataParts.push('Secure');
  }

  cookies.push(dataParts.join('; '));

  return cookies;
};

/**
 * @deprecated Use createSignedSessionCookies instead
 * Create a signed session cookie header value (legacy, only sets session_token)
 */
export const createSignedSessionCookie = async (
  options: Omit<SessionCookieOptions, 'sessionData'>,
): Promise<string> => {
  const { sessionToken, expiresAt, secure = process.env.NODE_ENV === 'production' } = options;

  const signedValue = await createSignedCookieValue(sessionToken);
  const encodedValue = encodeURIComponent(signedValue);

  const parts = [
    `better-auth.session_token=${encodedValue}`,
    `Path=/`,
    `Expires=${expiresAt.toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
};
