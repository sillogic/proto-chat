import { authEnv } from '@/envs/auth';

/**
 * Cookie signing utilities for Better Auth session tokens
 *
 * Better Auth uses HMAC-SHA256 signed cookies in the format: {value}.{base64_signature}
 * This module provides utilities to create compatible signed cookies.
 */

const ALGORITHM = { hash: 'SHA-256', name: 'HMAC' };

/**
 * Create a crypto key from the secret
 */
const getCryptoKey = async (secret: string): Promise<CryptoKey> => {
  const secretBuf = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey('raw', secretBuf, ALGORITHM, false, ['sign']);
};

/**
 * Create an HMAC-SHA256 signature in base64 format
 */
const makeSignature = async (value: string, secret: string): Promise<string> => {
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign(ALGORITHM.name, key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
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
 * Session cookie configuration
 */
export interface SessionCookieOptions {
  expiresAt: Date;
  secure?: boolean;
  sessionToken: string;
}

/**
 * Create a signed session cookie header value
 *
 * @param options - Session cookie options
 * @returns The Set-Cookie header value
 */
export const createSignedSessionCookie = async (options: SessionCookieOptions): Promise<string> => {
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
