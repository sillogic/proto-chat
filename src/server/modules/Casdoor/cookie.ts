import { createHmac } from 'node:crypto';

interface SessionData {
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
    createdAt: Date;
    email: string;
    emailVerified: boolean;
    fullName: string;
    id: string;
    updatedAt: Date;
    username: string | null;
  };
}

interface CreateSignedSessionCookiesParams {
  expiresAt: Date;
  protocol: string | null;
  sessionData: SessionData;
  sessionToken: string;
}

/**
 * Creates signed session cookies compatible with Better Auth's cookie cache
 */
export const createSignedSessionCookies = async ({
  sessionToken,
  sessionData,
  expiresAt,
  protocol,
}: CreateSignedSessionCookiesParams): Promise<string[]> => {
  const secret = process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET || '';
  const isSecure = protocol === 'https';
  const cookiePrefix = isSecure ? '__Secure-' : '';
  const cookieOptions = [
    `expires=${expiresAt.toUTCString()}`,
    'path=/',
    'SameSite=Lax',
    'HttpOnly',
    ...(isSecure ? ['Secure'] : []),
  ].join('; ');

  // Create HMAC signature for the session token
  const hmac = createHmac('sha256', secret);
  hmac.update(sessionToken);
  const signature = hmac.digest('base64url');
  const signedToken = `${sessionToken}.${signature}`;

  const sessionDataJson = JSON.stringify({
    session: {
      ...sessionData.session,
      createdAt: sessionData.session.createdAt.toISOString(),
      expiresAt: sessionData.session.expiresAt.toISOString(),
      updatedAt: sessionData.session.updatedAt.toISOString(),
    },
    user: {
      ...sessionData.user,
      createdAt: sessionData.user.createdAt.toISOString(),
      updatedAt: sessionData.user.updatedAt.toISOString(),
    },
  });

  // Sign the session data
  const dataHmac = createHmac('sha256', secret);
  dataHmac.update(sessionDataJson);
  const dataSignature = dataHmac.digest('base64url');
  const signedData = `${Buffer.from(sessionDataJson).toString('base64url')}.${dataSignature}`;

  return [
    `${cookiePrefix}better-auth.session_token=${signedToken}; ${cookieOptions}`,
    `${cookiePrefix}better-auth.session_data=${signedData}; ${cookieOptions}`,
  ];
};
