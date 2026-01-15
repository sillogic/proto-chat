import { serializeSignedCookie } from 'better-call';

import { authEnv } from '@/envs/auth';

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
  /** @deprecated No longer used - Better Auth handles session_data cache */
  sessionData?: SessionData;
  sessionToken: string;
}

/**
 * Create signed session cookies header values for Better Auth
 *
 * Returns an array of Set-Cookie header values.
 * Only creates session_token cookie - Better Auth will handle session_data cache itself.
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
    protocol,
    secure = protocol ? protocol === 'https' : process.env.NODE_ENV === 'production',
  } = options;

  const cookies: string[] = [];

  const signingSecret = authEnv.AUTH_SECRET;
  if (!signingSecret) {
    throw new Error('AUTH_SECRET is required for cookie signing');
  }

  // Use better-call's serializeSignedCookie for exact compatibility with Better-Auth
  // This ensures the signature format matches exactly what Better-Auth expects
  const cookie = await serializeSignedCookie(
    'better-auth.session_token',
    sessionToken,
    signingSecret,
    {
      path: '/',
      expires: expiresAt,
      httpOnly: true,
      sameSite: 'lax',
      secure,
    },
  );

  console.log('[ROPC Cookie] Cookie created using better-call serializeSignedCookie:');
  console.log('[ROPC Cookie]   token:', sessionToken);
  console.log('[ROPC Cookie]   cookie:', cookie);

  cookies.push(cookie);

  return cookies;
};

