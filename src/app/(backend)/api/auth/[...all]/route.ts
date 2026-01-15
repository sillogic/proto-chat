import { enableBetterAuth, enableNextAuth } from '@lobechat/const';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextRequest } from 'next/server';

import { auth } from '@/auth';
import { authEnv } from '@/envs/auth';
import NextAuthNode from '@/libs/next-auth';

const betterAuthHandler = toNextJsHandler(auth);

// Debug wrapper for get-session requests
const createDebugHandler = (handler: (req: NextRequest) => Promise<Response>, method: string) => {
  return async (req: NextRequest) => {
    const url = req.nextUrl.pathname;
    const isGetSession = url.includes('get-session');

    if (isGetSession) {
      console.log(`[BetterAuth] ===== ${method} ${url} =====`);
      console.log('[BetterAuth] AUTH_SECRET (first 20 chars):', authEnv.AUTH_SECRET?.slice(0, 20));
      console.log('[BetterAuth] AUTH_SECRET length:', authEnv.AUTH_SECRET?.length);
      const sessionToken = req.cookies.get('better-auth.session_token');
      console.log('[BetterAuth] session_token exists:', !!sessionToken);
      if (sessionToken) {
        // Log raw cookie value to check URL encoding
        console.log('[BetterAuth] raw cookie value:', sessionToken.value);
        console.log('[BetterAuth] cookie value length:', sessionToken.value.length);
        const parts = sessionToken.value.split('.');
        console.log('[BetterAuth] token part:', parts[0]);
        console.log('[BetterAuth] signature:', parts[1]);
        console.log('[BetterAuth] signature length:', parts[1]?.length);
      }
    }

    const response = await handler(req);

    if (isGetSession) {
      const cloned = response.clone();
      try {
        const body = await cloned.json();
        console.log('[BetterAuth] Response:', {
          hasSession: !!body?.session,
          hasUser: !!body?.user,
          userId: body?.user?.id,
        });
      } catch {
        console.log('[BetterAuth] Response: non-JSON');
      }
      console.log('[BetterAuth] =============================');
    }

    return response;
  };
};

export const GET = enableBetterAuth
  ? createDebugHandler(betterAuthHandler.GET, 'GET')
  : enableNextAuth
    ? NextAuthNode.handlers.GET
    : undefined;

export const POST = enableBetterAuth
  ? createDebugHandler(betterAuthHandler.POST, 'POST')
  : enableNextAuth
    ? NextAuthNode.handlers.POST
    : undefined;
