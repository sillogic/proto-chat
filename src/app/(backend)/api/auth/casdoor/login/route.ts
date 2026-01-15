import { createNanoId, idGenerator, serverDB } from '@lobechat/database';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { account, session } from '@/database/schemas/betterAuth';
import { users } from '@/database/schemas/user';
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis, isRedisEnabled } from '@/libs/redis';
import { CasdoorClient } from '@/server/modules/Casdoor';
import { createSignedSessionCookies } from '@/server/modules/Casdoor/cookie';
import type { CasdoorLoginRequest, CasdoorLoginResponse } from '@/server/modules/Casdoor/types';
import { UserService } from '@/server/services/user';
import { generateDefaultAvatar, isValidAvatar } from '@/server/utils/avatar';

// Session configuration
const SESSION_EXPIRES_IN_DAYS = 7;
const SESSION_TOKEN_LENGTH = 32;

// Better Auth secondaryStorage key prefix (must match config.ts)
const BETTER_AUTH_KEY_PREFIX = 'better-auth:';

/**
 * Generate a secure session token
 */
const generateSessionToken = () => createNanoId(SESSION_TOKEN_LENGTH)();

/**
 * Calculate session expiration date
 */
const getSessionExpiresAt = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRES_IN_DAYS);
  return expiresAt;
};

/**
 * Sync session to Redis secondaryStorage
 * This ensures Better Auth can find the session when validating
 */
const syncSessionToRedis = async (params: {
  expiresAt: Date;
  sessionData: {
    createdAt: Date;
    expiresAt: Date;
    id: string;
    ipAddress: string | null;
    token: string;
    updatedAt: Date;
    userAgent: string | null;
    userId: string;
  };
  userData: {
    avatar: string | null;
    createdAt: Date;
    email: string;
    emailVerified: boolean;
    fullName: string;
    id: string;
    updatedAt: Date;
    username: string | null;
  };
}) => {
  const redisConfig = getRedisConfig();
  console.log('[ROPC Login] Redis enabled:', isRedisEnabled(redisConfig));
  if (!isRedisEnabled(redisConfig)) {
    console.log('[ROPC Login] Redis is NOT enabled, skipping session sync');
    return;
  }

  try {
    const redisClient = await initializeRedis(redisConfig);
    if (!redisClient) return;

    const { sessionData, userData, expiresAt } = params;

    // Calculate TTL in seconds
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    if (ttl <= 0) return;

    // Build session key (Better Auth format: {token} - no "session." prefix)
    const sessionKey = `${BETTER_AUTH_KEY_PREFIX}${sessionData.token}`;

    // Build session value (Better Auth format: {user, session} - user first, no session.id)
    const sessionValue = JSON.stringify({
      user: {
        name: userData.fullName,
        email: userData.email,
        emailVerified: userData.emailVerified,
        image: userData.avatar,
        createdAt: userData.createdAt.toISOString(),
        updatedAt: userData.updatedAt.toISOString(),
        normalizedEmail: null,
        role: null,
        banned: false,
        banReason: null,
        banExpires: null,
        username: userData.username,
        id: userData.id,
      },
      session: {
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        expiresAt: sessionData.expiresAt.toISOString(),
        userId: sessionData.userId,
        token: sessionData.token,
        createdAt: sessionData.createdAt.toISOString(),
        updatedAt: sessionData.updatedAt.toISOString(),
      },
    });

    // Store session in Redis with TTL
    await redisClient.set(sessionKey, sessionValue, { ex: ttl });
    console.log('[ROPC Login] Session stored in Redis:');
    console.log('[ROPC Login]   key:', sessionKey);
    console.log('[ROPC Login]   ttl:', ttl, 'seconds');
  } catch (error) {
    // Log but don't fail the login - database session is still valid
    console.error('[Casdoor] Failed to sync session to Redis:', error);
  }
};

/**
 * Casdoor ROPC Login API
 *
 * This endpoint handles login via Casdoor's Resource Owner Password Credentials flow.
 * It validates credentials against Casdoor, creates/updates local user records,
 * and establishes a Better Auth compatible session.
 *
 * @param req - POST request with { identifier: string, password: string }
 * @returns { success: boolean, callbackUrl?: string, error?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body: CasdoorLoginRequest = await req.json();
    const { identifier, password } = body;

    // Validate input
    if (!identifier || !password) {
      return NextResponse.json(
        {
          error: 'Username/email and password are required',
          success: false,
        } satisfies CasdoorLoginResponse,
        { status: 400 },
      );
    }

    // Check if Casdoor is configured
    if (!CasdoorClient.isConfigured()) {
      return NextResponse.json(
        { error: 'Casdoor is not configured', success: false } satisfies CasdoorLoginResponse,
        { status: 500 },
      );
    }

    const casdoor = new CasdoorClient();

    // Step 1: Authenticate with Casdoor ROPC
    let tokenResponse;
    try {
      tokenResponse = await casdoor.getToken(identifier, password);
    } catch (error) {
      console.error('Casdoor authentication failed:', error);
      return NextResponse.json(
        { error: 'Invalid credentials', success: false } satisfies CasdoorLoginResponse,
        { status: 401 },
      );
    }

    // Step 2: Get user info from Casdoor
    let userInfo;
    try {
      userInfo = await casdoor.getUserInfo(tokenResponse.access_token);
    } catch (error) {
      console.error('Failed to get user info from Casdoor:', error);
      return NextResponse.json(
        { error: 'Failed to get user information', success: false } satisfies CasdoorLoginResponse,
        { status: 500 },
      );
    }

    // Step 3: Find or create user in local database
    const email = userInfo.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json(
        { error: 'User email is required', success: false } satisfies CasdoorLoginResponse,
        { status: 400 },
      );
    }

    // Check if user exists
    let [existingUser] = await serverDB
      .select({
        createdAt: users.createdAt,
        id: users.id,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const now = new Date();
    const displayName =
      userInfo.displayName || userInfo.name || userInfo.preferred_username || email.split('@')[0];

    if (!existingUser) {
      // Create new user
      const userId = idGenerator('user', 32 - 'user_'.length);

      // Use Casdoor avatar if available, otherwise generate a default one
      const casdoorAvatar = userInfo.avatar || userInfo.permanentAvatar;
      const avatar = isValidAvatar(casdoorAvatar) ? casdoorAvatar : generateDefaultAvatar(userId);

      await serverDB.insert(users).values({
        avatar,
        createdAt: now,
        email,
        emailVerified: userInfo.email_verified ?? false,
        fullName: displayName,
        id: userId,
        updatedAt: now,
        username: userInfo.preferred_username || userInfo.name,
      });

      // Initialize user with UserService
      const userService = new UserService(serverDB);
      await userService.initUser({
        email,
        id: userId,
        username: userInfo.preferred_username || userInfo.name || null,
      });

      existingUser = { createdAt: now, id: userId, updatedAt: now };
    } else {
      // Update existing user info (only update avatar if Casdoor provides one)
      const casdoorAvatar = userInfo.avatar || userInfo.permanentAvatar;
      await serverDB
        .update(users)
        .set({
          ...(isValidAvatar(casdoorAvatar) && { avatar: casdoorAvatar }),
          emailVerified: userInfo.email_verified ?? false,
          fullName: displayName,
          updatedAt: now,
        })
        .where(eq(users.id, existingUser.id));

      // Update the existingUser object with latest updatedAt
      existingUser.updatedAt = now;
    }

    // Step 4: Create or update account record
    const [existingAccount] = await serverDB
      .select({ id: account.id })
      .from(account)
      .where(eq(account.userId, existingUser.id))
      .limit(1);

    const accountId = existingAccount?.id || createNanoId(12)();
    const casdoorAccountId = userInfo.sub || userInfo.name;

    if (!existingAccount) {
      await serverDB.insert(account).values({
        accessToken: tokenResponse.access_token,
        accessTokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        accountId: casdoorAccountId,
        createdAt: now,
        id: accountId,
        providerId: 'casdoor',
        refreshToken: tokenResponse.refresh_token,
        scope: tokenResponse.scope,
        updatedAt: now,
        userId: existingUser.id,
      });
    } else {
      await serverDB
        .update(account)
        .set({
          accessToken: tokenResponse.access_token,
          accessTokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
          refreshToken: tokenResponse.refresh_token,
          scope: tokenResponse.scope,
          updatedAt: now,
        })
        .where(eq(account.id, existingAccount.id));
    }

    // Step 5: Create session
    const sessionToken = generateSessionToken();
    const sessionExpiresAt = getSessionExpiresAt();
    const sessionId = createNanoId(12)();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;

    console.log('[ROPC Login] Creating session:');
    console.log('[ROPC Login]   sessionId:', sessionId);
    console.log('[ROPC Login]   sessionToken:', sessionToken);
    console.log('[ROPC Login]   userId:', existingUser.id);

    await serverDB.insert(session).values({
      createdAt: now,
      expiresAt: sessionExpiresAt,
      id: sessionId,
      ipAddress,
      token: sessionToken,
      updatedAt: now,
      userAgent,
      userId: existingUser.id,
    });

    // Verify session was inserted
    const [verifySession] = await serverDB
      .select({ id: session.id, token: session.token })
      .from(session)
      .where(eq(session.token, sessionToken))
      .limit(1);
    console.log('[ROPC Login] Session verified in DB:', !!verifySession);

    // Step 5.1: Sync session to Redis for Better Auth secondaryStorage
    console.log('[ROPC Login] Syncing session to Redis...');
    await syncSessionToRedis({
      expiresAt: sessionExpiresAt,
      sessionData: {
        createdAt: now,
        expiresAt: sessionExpiresAt,
        id: sessionId,
        ipAddress,
        token: sessionToken,
        updatedAt: now,
        userAgent,
        userId: existingUser.id,
      },
      userData: {
        avatar: userInfo.avatar || userInfo.permanentAvatar || null,
        createdAt: existingUser.createdAt,
        email,
        emailVerified: userInfo.email_verified ?? false,
        fullName: displayName,
        id: existingUser.id,
        updatedAt: existingUser.updatedAt,
        username: userInfo.preferred_username || userInfo.name || null,
      },
    });

    // Get callback URL from query params or default to '/'
    const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') || '/';

    // Step 6: Create response with signed session cookies
    const response = NextResponse.json({
      callbackUrl,
      success: true,
    } satisfies CasdoorLoginResponse);

    // Get protocol from X-Forwarded-Proto header (for reverse proxy setups)
    const forwardedProto = req.headers.get('x-forwarded-proto');

    // Set signed session cookies (Better Auth requires both session_token and session_data for cookieCache)
    const signedCookies = await createSignedSessionCookies({
      expiresAt: sessionExpiresAt,
      protocol: forwardedProto,
      sessionData: {
        session: {
          createdAt: now,
          expiresAt: sessionExpiresAt,
          id: sessionId,
          ipAddress,
          token: sessionToken,
          updatedAt: now,
          userAgent,
          userId: existingUser.id,
        },
        user: {
          avatar: userInfo.avatar || userInfo.permanentAvatar || null,
          createdAt: existingUser.createdAt,
          email,
          emailVerified: userInfo.email_verified ?? false,
          fullName: displayName,
          id: existingUser.id,
          updatedAt: existingUser.updatedAt,
          username: userInfo.preferred_username || userInfo.name || null,
        },
      },
      sessionToken,
    });

    // Append all session cookies to response
    for (const cookie of signedCookies) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error) {
    console.error('Casdoor login error:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false } satisfies CasdoorLoginResponse,
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
