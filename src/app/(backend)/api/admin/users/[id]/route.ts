import { NextRequest, NextResponse } from 'next/server';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/routers/lambda';
import { createTRPCContext } from '@/server/routers/context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 创建 tRPC caller
    const createCaller = createCallerFactory<typeof appRouter>();
    const ctx = await createTRPCContext({
      req: request,
      resHeaders: new Headers(),
    });
    const caller = createCaller(ctx);

    // 调用 tRPC 用户详情方法
    const result = await caller.admin.users.detail(id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Get user detail error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '获取用户详情失败',
    });
  }
}