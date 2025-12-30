import { createNanoId, idGenerator, serverDB } from '@lobechat/database';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { account, session } from '@/database/schemas/betterAuth';
import { users } from '@/database/schemas/user';
import { CasdoorClient } from '@/server/modules/Casdoor';
import { createSignedSessionCookie } from '@/server/modules/Casdoor/cookie';
import type { CasdoorSignupRequest, CasdoorSignupResponse } from '@/server/modules/Casdoor/types';
import { UserService } from '@/server/services/user';

// Session configuration
const SESSION_EXPIRES_IN_DAYS = 7;
const SESSION_TOKEN_LENGTH = 32;

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
 * Validate email format
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
const isValidPassword = (password: string): { error?: string; valid: boolean } => {
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters', valid: false };
  }
  if (password.length > 64) {
    return { error: 'Password must be at most 64 characters', valid: false };
  }
  // Check for at least one letter and one number
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  if (!hasLetter || !hasNumber) {
    return { error: 'Password must contain at least one letter and one number', valid: false };
  }
  return { valid: true };
};

/**
 * Casdoor ROPC Signup API
 *
 * This endpoint handles user registration via Casdoor's API.
 * It creates a user in Casdoor, then automatically logs them in.
 *
 * @param req - POST request with { username: string, email: string, password: string }
 * @returns { success: boolean, callbackUrl?: string, error?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body: CasdoorSignupRequest = await req.json();
    const { username, email, password } = body;

    // Validate input
    if (!username || !email || !password) {
      return NextResponse.json(
        {
          error: 'Username, email, and password are required',
          success: false,
        } satisfies CasdoorSignupResponse,
        { status: 400 },
      );
    }

    // Validate username format
    if (!/^\w+$/.test(username) || username.length < 2 || username.length > 32) {
      return NextResponse.json(
        {
          error:
            'Username must be 2-32 characters and contain only letters, numbers, and underscores',
          success: false,
        } satisfies CasdoorSignupResponse,
        { status: 400 },
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format', success: false } satisfies CasdoorSignupResponse,
        { status: 400 },
      );
    }

    // Validate password
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error, success: false } satisfies CasdoorSignupResponse,
        { status: 400 },
      );
    }

    // Check if Casdoor is configured
    if (!CasdoorClient.isConfigured()) {
      return NextResponse.json(
        { error: 'Casdoor is not configured', success: false } satisfies CasdoorSignupResponse,
        { status: 500 },
      );
    }

    // Check if email already exists in local database
    const normalizedEmail = email.toLowerCase().trim();
    const [existingUser] = await serverDB
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered', success: false } satisfies CasdoorSignupResponse,
        { status: 409 },
      );
    }

    const casdoor = new CasdoorClient();

    // Step 1: Create user in Casdoor
    // Note: displayName is automatically set to username by the Casdoor client
    try {
      await casdoor.createUser({
        displayName: username, // Set displayName to username as per requirement
        email: normalizedEmail,
        name: username,
        password,
      });
    } catch (error) {
      console.error('Casdoor user creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';

      // Check for common errors
      if (errorMessage.includes('already exists')) {
        return NextResponse.json(
          {
            error: 'Username or email already exists',
            success: false,
          } satisfies CasdoorSignupResponse,
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: errorMessage, success: false } satisfies CasdoorSignupResponse,
        { status: 400 },
      );
    }

    // Step 2: Auto-login - get tokens from Casdoor
    let tokenResponse;
    try {
      tokenResponse = await casdoor.getToken(username, password);
    } catch (error) {
      console.error('Auto-login after signup failed:', error);
      // User was created but auto-login failed - still return success
      // User can login manually
      return NextResponse.json({
        callbackUrl: '/signin',
        success: true,
      } satisfies CasdoorSignupResponse);
    }

    // Step 3: Get user info from Casdoor
    let userInfo;
    try {
      userInfo = await casdoor.getUserInfo(tokenResponse.access_token);
    } catch (error) {
      console.error('Failed to get user info after signup:', error);
      return NextResponse.json({
        callbackUrl: '/signin',
        success: true,
      } satisfies CasdoorSignupResponse);
    }

    // Step 4: Create user in local database
    const now = new Date();
    const userId = idGenerator('user', 32 - 'user_'.length);

    await serverDB.insert(users).values({
      avatar: userInfo.avatar || userInfo.permanentAvatar,
      createdAt: now,
      email: normalizedEmail,
      emailVerified: userInfo.email_verified ?? false,
      fullName: username, // displayName = username as per requirement
      id: userId,
      updatedAt: now,
      username,
    });

    // Initialize user with UserService
    const userService = new UserService(serverDB);
    await userService.initUser({
      email: normalizedEmail,
      id: userId,
      username,
    });

    // Step 5: Create account record
    const accountId = createNanoId(12)();
    const casdoorAccountId = userInfo.sub || username;

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
      userId,
    });

    // Step 6: Create session
    const sessionToken = generateSessionToken();
    const sessionExpiresAt = getSessionExpiresAt();
    const sessionId = createNanoId(12)();

    await serverDB.insert(session).values({
      createdAt: now,
      expiresAt: sessionExpiresAt,
      id: sessionId,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      token: sessionToken,
      updatedAt: now,
      userAgent: req.headers.get('user-agent') || null,
      userId,
    });

    // Get callback URL from query params or default to '/'
    const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') || '/';

    // Step 7: Create response with signed session cookie
    const response = NextResponse.json({
      callbackUrl,
      success: true,
    } satisfies CasdoorSignupResponse);

    // Set signed session cookie (Better Auth uses HMAC-SHA256 signed cookies)
    const signedCookie = await createSignedSessionCookie({
      expiresAt: sessionExpiresAt,
      sessionToken,
    });
    response.headers.append('Set-Cookie', signedCookie);

    return response;
  } catch (error) {
    console.error('Casdoor signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false } satisfies CasdoorSignupResponse,
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
