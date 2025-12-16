import { NextRequest, NextResponse } from 'next/server';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/routers/lambda';
import { createTRPCContext } from '@/server/routers/context';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        message: '用户名和密码不能为空',
      });
    }

    // 创建 tRPC caller
    const createCaller = createCallerFactory<typeof appRouter>();
    const ctx = await createTRPCContext({
      req: request,
      resHeaders: new Headers(),
    });
    const caller = createCaller(ctx);

    // 调用 tRPC 认证方法
    const result = await caller.admin.auth.login({ username, password });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Admin login error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '登录失败，请稍后重试',
    });
  }
}